## Overview

This program collects Ethereum block and transaction data by using the Infura API to make RPC (remote procedure call) requests to RPC nodes within the blockchain, which then allow us to access information about updates in the network.

## User Guide
Step 1. Start SQL connection in unix terminal with `sudo service mysql start`\
Step 2. Run script(s)\
Step 3. To open the database, open SQL with `mysql -u root -p` and run `USE ethereum_data;`\
Step 4. Run `SHOW TABLES;` and then run `SELECT FROM table_name` to display desired table
