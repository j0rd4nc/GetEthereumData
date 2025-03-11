// Connect to the Ethereum node (e.g., Infura)
const infuraUrl = 'https://mainnet.infura.io/v3/c80ff596b4aa49ac914f01e097c05b67';

const mysql = require('mysql2');
const axios = require('axios');

// MySQL connection setup
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'password'
});

async function initializeDatabase() {
    return new Promise((resolve, reject) => {
        connection.connect((err) => {
            if (err) return reject(err);
            console.log('Connected to MySQL!');

            const createDatabaseQuery = `CREATE DATABASE IF NOT EXISTS ethereum_data`;
            connection.query(createDatabaseQuery, (err) => {
                if (err) return reject(err);
                console.log('Database created');

                // Select the database to use
                connection.query('USE ethereum_data', (err) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        });
    });
}

async function createBlockTable() {
    return new Promise((resolve, reject) => {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ethereum_data.blocks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                block_number INT NOT NULL,
                block_size INT,
                total_gas_used INT,
                transaction_count INT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        connection.query(createTableQuery, (err) => {
            if (err) return reject(err);
            console.log('Block table created');
            resolve();
        });
    });
}

async function createTransactionsTable(blockNumber) {
    return new Promise((resolve, reject) => {
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS ethereum_data.block_` + blockNumber.toString() + `_transactions (
                transaction_index INT,
                gas_price TEXT,
                from_address TEXT,
                to_address TEXT,
                value TEXT,
                nonce INT
            )
        `;
        connection.query(createTableQuery, (err) => {
            if (err) return reject(err);
            console.log('Transaction table for block ' + blockNumber + ' created');
            resolve();
        });
    });
}

async function makeRpcRequest(method, params) {
    const payload = {
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
    };
    try {
        const response = await axios.post(infuraUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        }); // Note: post is used here instead of get because we need to send data to the server
        return response.data.result;
    } catch (error) {
        console.error('Error making RPC request:', error);
        throw error;
    }
}

async function storeBlockData(blockNumber, blockSize, gasUsed, transactions) {
    const insertQuery = `
        INSERT INTO blocks (block_number, block_size, total_gas_used, transaction_count)
        VALUES (?, ?, ?, ?)
    `;
    connection.query(insertQuery, [blockNumber, blockSize, gasUsed, transactions], (err) => {
        if (err) throw err;
        console.log(`Block ${blockNumber} data stored successfully.`);
    });
}

async function storeTransactionData(blockNumber, index, gasPrice, from, to, value, nonce) {
    const insertQuery = `
        INSERT INTO block_` + blockNumber.toString() + `_transactions (transaction_index, gas_price, from_address, to_address, value, nonce)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    connection.query(insertQuery, [index, gasPrice, from, to, value, nonce], (err) => {
        if (err) throw err;
    });
}

async function getBlockByNumber(blockNumber) {
    const hexBlockNumber = `0x${blockNumber.toString(16)}`; // Convert block number to hex with '0x' prefix
    const params = [hexBlockNumber, false];  // True to get full transaction objects
    const block = await makeRpcRequest('eth_getBlockByNumber', params);
    return block;
}

async function getLatestBlock() {
    const params = ['latest', true];  // True to get full transaction objects
    const block = await makeRpcRequest('eth_getBlockByNumber', params);
    return block;
}

async function getUncleCountByBlockNumber(blockNumber) {
    const hexBlockNumber = `0x${blockNumber.toString(16)}`;
    const params = [hexBlockNumber];
    const uncleCount = await makeRpcRequest('eth_getUncleCountByBlockNumber', params);
    return uncleCount;
}

async function getBlockTransactionCountByBlockNumber(blockNumber) {
    const hexBlockNumber = `0x${blockNumber.toString(16)}`;
    const params = [hexBlockNumber];
    const block = await makeRpcRequest('eth_getBlockTransactionCountByNumber', params);
    return block;
}

async function getLatestBlockTransactionCountNumber() {
    const params = ["latest"];
    const block = await makeRpcRequest('eth_getBlockTransactionCountByNumber', params);
    return block;
}

async function fetchBlocksInRange(startBlock, endBlock) {
    const blocks = [];
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
        const block = await getBlockByNumber(blockNumber);
        blocks.push(block);
    }
    return blocks;
}

async function getTransactionData(blockNumber, index) {
    const hexBlockNumber = `0x${blockNumber.toString(16)}`;
    const hexIndex = `0x${index.toString(16)}`;
    const params = [hexBlockNumber, hexIndex];
    const transactionData = await makeRpcRequest('eth_getTransactionByBlockNumberAndIndex', params);
    return transactionData; 
}

function wait(seconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, seconds * 1000); // Convert seconds to milliseconds
    });
}

(async () => {
    try {
        await initializeDatabase();
        await createBlockTable();

        while (true) {
            const block = await getLatestBlock();
                
            const latestBlockNumber = Number(block.number);
            console.log(`Current Latest Block Number:`, latestBlockNumber);

            const transactionCount = await getBlockTransactionCountByBlockNumber(latestBlockNumber);
            console.log("Transaction Count of Block " + latestBlockNumber + ": " + Number(transactionCount));

            // Store the block data in the MySQL database
            await storeBlockData(latestBlockNumber, Number(block.size), Number(block.gasUsed), Number(transactionCount));

            await createTransactionsTable(latestBlockNumber);

            for (let i = 0; i < Number(transactionCount); i++) {
                const transactionData = await getTransactionData(latestBlockNumber, i);

                await storeTransactionData(
                    latestBlockNumber,
                    i, 
                    Number(transactionData.gasPrice),
                    transactionData.from,
                    transactionData.to,
                    Number(transactionData.value),
                    Number(transactionData.nonce)
                );
            }

            console.log(`Block ${latestBlockNumber} transaction data stored successfully.\n`);
        }
    } catch (error) {
        console.error('Error fetching blocks:', error);
    } finally {
        connection.end();
    }
})();