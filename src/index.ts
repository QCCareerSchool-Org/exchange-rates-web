import Debug from 'debug';
import dotenv from 'dotenv';
import mysql from 'promise-mysql';
import rp from 'request-promise';

const debug = Debug('index');

dotenv.config();

debug('Starting request');

(async () => {

  try {

    // perform a GET request for the currency data
    const url = `http://data.fixer.io/api/latest?access_key=${process.env.FIXER_API_KEY}&symbols=USD,AUD,CAD,NZD,GBP,ZAR`;
    const response: IExchangeResult = await rp(url, { json: true });

    debug(response);

    // see if the data makes sense
    if (typeof response.rates === 'undefined')
      throw new Error('No rates supplied');

    if (typeof response.date !== 'string')
      throw new Error('No date supplied');

    if (!/^\d{4}-\d{2}-\d{2}$/.test(response.date))
      throw new Error('Unrecognized date format');

    if (typeof response.rates.USD === 'undefined')
      throw new Error('No USD rate found');

    // convert the rates to a USD base
    const rates: any = {};
    rates.USD = 1;
    rates.EUR = 1 / response.rates.USD;
    for (const r in response.rates) {
      if (!response.rates.hasOwnProperty(r)) continue;
      if (r === 'USD' || r === 'EUR') continue;
      rates[r] = response.rates[r] * rates.EUR;
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

    try {

      const connection = await mysql.createConnection(options);

      try {

        // find out which currencies need updating
        let sqlSelect;
        if (typeof process.env.ALL_CURRENCIES !== 'undefined' && process.env.ALL_CURRENCIES === 'TRUE')
          sqlSelect = "SELECT code FROM currencies WHERE NOT code = 'USD'";
        else
          sqlSelect = "SELECT code FROM currencies WHERE NOT code = 'USD' AND NOT `update` = 0";

        const currencies: ICurrency[] = await connection.query(sqlSelect);

        const sqlUpdate = 'UPDATE currencies SET exchange = ?, last_updated = NOW() WHERE code = ?';

        const promises: Array<PromiseLike<any>> = [];

        // update the currencies in parallel
        for (const currency of currencies) {
          if (typeof rates[currency.code] !== 'number') {
            debug(`${currency.code} not found`);
            continue;
          }
          const rate = rates[currency.code];
          debug(`Updating ${currency.code}: ${rate}`);
          if (typeof process.env.TESTING === 'undefined')
            promises.push(connection.query(sqlUpdate, [ rate, currency.code ]));
        }

        // wait for all of the updates
        await Promise.all(promises);

      } finally {
        connection.end();
      }
    } catch (err) {
      debug('Database error: ' + err.message);
    }
  } catch (err) {
    debug('Error: ' + err.message);
  }

})();

interface IExchangeResult {
  base: string;
  date: string;
  rates: { [symbol: string]: number; };
}

interface ICurrency {
  code: string;
}
