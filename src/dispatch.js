import { PassThrough, Duplex } from 'stream';
import assert from 'assert';
import http from 'http';
import pMap from 'p-map';
import cbor from 'cbor';
import config from './config';

const parseAddress = (srvr) => {
    if (typeof srvr !== 'string') {
        return null;
    }
    const hostWithPort = srvr.match(/^\[?([^\]]+)\]?:(\d+)$/);
    if (hostWithPort) {
        return {
            hostname: hostWithPort[1],
            port: Number(hostWithPort[2]),
        };
    }
    return {
        hostname: srvr,
        port: Number(config.port),
    };
};

const registerTo = ({ hostname, port }, commands) =>
    new Promise((resolve, reject) => {
        const requestBody = JSON.stringify(commands);
        const requestOptions = {
            hostname,
            port,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': requestBody.length,
            },
        };
        http.request(requestOptions, (res) => {
            let requestResponse = '';
            res.setEncoding('utf8');
            res.on('error', error => reject(error));
            res.on('data', (chunk) => {
                requestResponse += chunk;
            });
            res.on('end', () => {
                try {
                    const result = JSON.parse(requestResponse);
                    console.log(`Register ${hostname}:${port} with ${result}.`);
                    resolve({
                        hostname,
                        port,
                        path: `/${result}`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    });
                } catch (e) {
                    reject(e);
                }
            });
        }).write(requestBody);
    });

const connectTo = tub => serversOptions =>
    new Promise((resolve, reject) => {
        if (serversOptions) {
            resolve(serversOptions.map(
                serverOptions =>
                http.request(serverOptions,
                    (res) => {
                        if (res.statusCode === 200) {
                            res.setEncoding('utf8');
                            res.on('data', chunk => tub.write(chunk));
                            res.on('end', () => tub.end());
                        } else {
                            console.error(`Server return ${res.statusCode}`);
                        }
                    }),
            ));
        } else {
            reject(new Error('Invalid servers options.'));
        }
    });

export default class Dispatch extends Duplex {
    constructor(ezs, commands, servers) {
        super({ objectMode: true });

        const decoder = new cbor.Decoder();
        this.handles = [];
        this.tubin = new PassThrough({ objectMode: true });
        this.tubout = this.tubin.pipe(decoder);

        this.on('finish', () => {
            this.handles.forEach(handle => handle.end());
        });
        this.tubout.on('data', (chunk, encoding) => {
            this.push(chunk, encoding);
        });
        this.tubout.on('finish', () => {
            this.push(null);
        });
        this.tubout.on('error', (e) => {
            console.error('Unlikely error', e);
        });
        this.tubout.pause();

        assert(Array.isArray(commands), 'commands should be an array.');
        assert(Array.isArray(servers), 'servers should be an array.');

        this.servers = servers.map(parseAddress).filter(x => x);
        this.commands = commands;
        this.semaphore = true;
        this.lastIndex = 0;
    }

    _write(chunk, encoding, callback) {
        const self = this;
        if (self.semaphore) {
            self.semaphore = false;
            pMap(self.servers, server => registerTo(server, self.commands))
                .then(connectTo(self.tubin))
                .then((handles) => {
                    self.handles = handles;
                    self.balance(chunk, encoding, callback);
                });
        } else {
            self.balance(chunk, encoding, callback);
        }
    }

    _read(size) {
        this.lastSize = size;
        if (this.tubout.isPaused()) {
            this.tubout.resume();
        }
    }

    balance(chunk, encoding, callback) {
        this.lastIndex += 1;
        if (this.lastIndex >= this.handles.length) {
            this.lastIndex = 0;
        }
        // console.log(`Balance on #${this.lastIndex}`, chunk);
        this.handles[this.lastIndex].write(cbor.encode(chunk), encoding, callback);
    }

}
