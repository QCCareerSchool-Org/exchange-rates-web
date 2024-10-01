"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var debug_1 = __importDefault(require("debug"));
var dotenv_1 = __importDefault(require("dotenv"));
var fs_1 = require("fs");
var promise_mysql_1 = __importDefault(require("promise-mysql"));
var request_promise_1 = __importDefault(require("request-promise"));
var debug = debug_1.default('index');
dotenv_1.default.config();
debug('Starting request');
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var url, response, rates, r, options, _a, connection, sqlSelect, currencies, sqlUpdate, promises, _i, currencies_1, currency, rate, err_1, err_2;
    var _b;
    var _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 15, , 16]);
                url = "http://data.fixer.io/api/latest?access_key=" + process.env.FIXER_API_KEY + "&symbols=USD,AUD,CAD,NZD,GBP,ZAR";
                return [4 /*yield*/, request_promise_1.default(url, { json: true })];
            case 1:
                response = _f.sent();
                debug(response);
                // see if the data makes sense
                if (typeof response.rates === 'undefined') {
                    throw new Error('No rates supplied');
                }
                if (typeof response.date !== 'string') {
                    throw new Error('No date supplied');
                }
                if (!/^\d{4}-\d{2}-\d{2}$/u.test(response.date)) {
                    throw new Error('Unrecognized date format');
                }
                if (typeof response.rates.USD === 'undefined') {
                    throw new Error('No USD rate found');
                }
                rates = {};
                rates.USD = 1;
                rates.EUR = 1 / response.rates.USD;
                for (r in response.rates) {
                    if (!response.rates.hasOwnProperty(r))
                        continue;
                    if (r === 'USD' || r === 'EUR')
                        continue;
                    rates[r] = response.rates[r] * rates.EUR;
                }
                options = {
                    user: process.env.DB_USER,
                    password: process.env.DB_PASSWORD,
                    database: process.env.DB_DATABASE,
                };
                if (!(process.env.DB_TLS === 'true')) return [3 /*break*/, 5];
                _a = options;
                _b = {};
                return [4 /*yield*/, fs_1.promises.readFile((_c = process.env.DB_SERVER_CA) !== null && _c !== void 0 ? _c : 'server-ca.pem')];
            case 2:
                _b.ca = _f.sent();
                return [4 /*yield*/, fs_1.promises.readFile((_d = process.env.DB_CLIENT_CERT) !== null && _d !== void 0 ? _d : 'client-cert.pem')];
            case 3:
                _b.cert = _f.sent();
                return [4 /*yield*/, fs_1.promises.readFile((_e = process.env.DB_CLIENT_KEY) !== null && _e !== void 0 ? _e : 'client-key.pem')];
            case 4:
                _a.ssl = (_b.key = _f.sent(),
                    _b);
                _f.label = 5;
            case 5:
                if (typeof process.env.DB_SOCKET_PATH !== 'undefined') { // prefer a socketPath
                    options.socketPath = process.env.DB_SOCKET_PATH;
                }
                else if (typeof process.env.DB_HOST !== 'undefined') { // but use a host otherwise
                    options.host = process.env.DB_HOST;
                }
                _f.label = 6;
            case 6:
                _f.trys.push([6, 13, , 14]);
                return [4 /*yield*/, promise_mysql_1.default.createConnection(options)];
            case 7:
                connection = _f.sent();
                _f.label = 8;
            case 8:
                _f.trys.push([8, , 11, 12]);
                sqlSelect = void 0;
                if (typeof process.env.ALL_CURRENCIES !== 'undefined' && process.env.ALL_CURRENCIES === 'TRUE') {
                    sqlSelect = "SELECT code FROM currencies WHERE NOT code = 'USD'";
                }
                else {
                    sqlSelect = "SELECT code FROM currencies WHERE NOT code = 'USD' AND NOT `update` = 0";
                }
                return [4 /*yield*/, connection.query(sqlSelect)];
            case 9:
                currencies = _f.sent();
                sqlUpdate = 'UPDATE currencies SET exchange = ?, last_updated = NOW() WHERE code = ?';
                promises = [];
                // update the currencies in parallel
                for (_i = 0, currencies_1 = currencies; _i < currencies_1.length; _i++) {
                    currency = currencies_1[_i];
                    if (typeof rates[currency.code] !== 'number') {
                        debug(currency.code + " not found");
                        continue;
                    }
                    rate = rates[currency.code];
                    debug("Updating " + currency.code + ": " + rate);
                    if (typeof process.env.TESTING === 'undefined') {
                        promises.push(connection.query(sqlUpdate, [rate, currency.code]));
                    }
                }
                // wait for all of the updates
                return [4 /*yield*/, Promise.all(promises)];
            case 10:
                // wait for all of the updates
                _f.sent();
                return [3 /*break*/, 12];
            case 11:
                connection.end();
                return [7 /*endfinally*/];
            case 12: return [3 /*break*/, 14];
            case 13:
                err_1 = _f.sent();
                debug('Database error: ' + (err_1 instanceof Error ? err_1.message : err_1));
                return [3 /*break*/, 14];
            case 14: return [3 /*break*/, 16];
            case 15:
                err_2 = _f.sent();
                debug('Error: ' + (err_2 instanceof Error ? err_2.message : err_2));
                return [3 /*break*/, 16];
            case 16: return [2 /*return*/];
        }
    });
}); })();
