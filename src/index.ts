import * as Debug from 'debug';
import * as dotenv from 'dotenv';
import * as https from 'https';
import * as mysql from 'promise-mysql';

const debug = Debug('index');

dotenv.config();

debug('Starting request');

// perform a GET request for the currency data
const url = 'https://api.fixer.io/latest?base=USD';
https.get(url, (resp) => {
    let data = '';

    resp.on('data', (chunk) => {
        data += chunk;
    });

    resp.on('end', () => {
        debug('Got response');
        updateDatabase(data);
    });

    resp.on('error', (err) => {
        debug(err);
    });
});

function updateDatabase(data: string) {

    let jsonData: any;
    try {
        jsonData = JSON.parse(data);
    } catch (err) {
        debug('JSON parse error: ' + err.message);
        return;
    }

    // set up the database configuration options
    const options: mysql.ConnectionConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
    };

    if (typeof process.env.DB_SOCKET_PATH !== 'undefined') // prefer a socketPath
        options.socketPath = process.env.DB_SOCKET_PATH;
    else if (typeof process.env.DB_HOST !== 'undefined') // but use a host otherwise
        options.host = process.env.DB_HOST;

    let connection: mysql.Connection;

    mysql.createConnection(options).then((con) => {

        connection = con; // store for later

        if (typeof jsonData.rates === 'undefined')
            throw new Error('No rates supplied');

        // find out which currencies need updating
        let sqlSelect;
        if (typeof process.env.ALL_CURRENCIES !== 'undefined' && process.env.ALL_CURRENCIES === 'TRUE')
            sqlSelect = "SELECT code FROM currencies WHERE NOT code = 'USD'";
        else
            sqlSelect = "SELECT code FROM currencies WHERE NOT code = 'USD' AND NOT `update` = 0";
        return connection.query(sqlSelect);

    }).then((currencies) => {

        const sqlUpdate = 'UPDATE currencies SET exchange = ?, last_updated = NOW() WHERE code = ?';

        const promises: Array<Promise<any>> = [];

        // update the currencies in parallel
        for (const currency of currencies)
            if (typeof jsonData.rates[currency.code] !== 'number')
                debug(`${currency.code} not found`);
            else {
                debug(`Updating ${currency.code}: ${jsonData.rates[currency.code]}`);
                const rate = jsonData.rates[currency.code];
                if (typeof process.env.TESTING === 'undefined')
                    promises.push(connection.query(sqlUpdate, [ rate, currency.code ]));
            }

        // wait for all of the updates
        return Promise.all(promises);

    }).catch((err) => {

        debug('Database error: ' + err.message);

    }).then(() => {

        if (connection && connection.end)
            connection.end();

    });
}
