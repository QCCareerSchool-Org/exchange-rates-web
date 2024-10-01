import Debug from 'debug';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import mysql from 'promise-mysql';

const debug = Debug('index');

dotenv.config();

debug('Starting request');

const currencyCodes = [ 'USD', 'AUD', 'CAD', 'NZD', 'GBP', 'ZAR' ];

const getRates = async (): Promise<Record<string, number>> => {
  const url = `http://data.fixer.io/api/latest?access_key=${process.env.FIXER_API_KEY}&symbols=${currencyCodes.join(',')}}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw Error(response.statusText);
  }

  const body: IExchangeResult = await response.json();

  if (typeof body.rates === 'undefined') {
    throw new Error('No rates supplied');
  }

  if (typeof body.date !== 'string') {
    throw new Error('No date supplied');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/u.test(body.date)) {
    throw new Error('Unrecognized date format');
  }

  if (typeof body.rates.USD === 'undefined') {
    throw new Error('No USD rate found');
  }

  // convert the rates to a USD base
  const rates: Record<string, number> = {};
  rates.USD = 1;
  rates.EUR = 1 / body.rates.USD;
  for (const r in body.rates) {
    if (!body.rates.hasOwnProperty(r)) continue;
    if (r === 'USD' || r === 'EUR') continue;
    rates[r] = body.rates[r] * rates.EUR;
  }

  return rates;
}

(async () => {

  try {
    const rates = await getRates();
    console.log(rates);

    // set up the database configuration options
    const options: mysql.ConnectionConfig = {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
    };

    if (process.env.DB_TLS === 'true') {
      options.ssl = {
        ca: await fs.readFile(process.env.DB_SERVER_CA ?? 'server-ca.pem'),
        cert: await fs.readFile(process.env.DB_CLIENT_CERT ?? 'client-cert.pem'),
        key: await fs.readFile(process.env.DB_CLIENT_KEY ?? 'client-key.pem'),
      }
    }

    if (typeof process.env.DB_SOCKET_PATH !== 'undefined') { // prefer a socketPath
      options.socketPath = process.env.DB_SOCKET_PATH;
    } else if (typeof process.env.DB_HOST !== 'undefined') { // but use a host otherwise
      options.host = process.env.DB_HOST;
    }

    try {
      const connection = await mysql.createConnection(options);

      try {
        // find out which currencies need updating
        const sqlSelect = "SELECT code FROM currencies WHERE NOT code = 'USD' AND NOT `update` = 0";

        const currencies: ICurrency[] = await connection.query(sqlSelect);

        const sqlUpdate = 'UPDATE currencies SET exchange = ?, last_updated = NOW() WHERE code = ?';

        // update the currencies in parallel
        for (const currency of currencies) {
          if (typeof rates[currency.code] !== 'number') {
            debug(`${currency.code} not found`);
            continue;
          }
          const rate = rates[currency.code];
          debug(`Updating ${currency.code}: ${rate}`);
          if (typeof process.env.TESTING === 'undefined') {
            await connection.query(sqlUpdate, [rate, currency.code]);
          }
        }

      } finally {
        connection.end();
      }
    } catch (err) {
      debug('Database error: ' + (err instanceof Error ? err.message : err));
    }
  } catch (err) {
    debug('Error: ' + (err instanceof Error ? err.message : err));
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
