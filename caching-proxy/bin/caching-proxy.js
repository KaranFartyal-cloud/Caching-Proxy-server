#!/usr/bin/env node

const { Command } = require('commander');
const cache = require('../lib/cache');
const startServer = require('../lib/server');

const program = new Command();

program
  .name('caching-proxy')
  .description('Start a caching proxy server that forwards requests to an origin server and caches the responses.')
  .option('-p, --port <number>', 'port on which the caching proxy server will run')
  .option('-o, --origin <url>', 'URL of the server to which requests will be forwarded')
  .option('-c, --clear-cache', 'clear the cache and exit')
  .parse(process.argv);

const options = program.opts();

if (options.clearCache) {
  cache.clear();
  console.log('Cache cleared.');
  process.exit(0);
}

if (!options.port || !options.origin) {
  console.error('Error: both --port and --origin are required to start the server.\n');
  program.help({ error: true });
  process.exit(1);
}

const port = Number(options.port);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Error: "${options.port}" is not a valid port number.`);
  process.exit(1);
}

let origin;
try {
  origin = new URL(options.origin).toString();
} catch (err) {
  console.error(`Error: "${options.origin}" is not a valid URL.`);
  process.exit(1);
}

startServer(port, origin);
