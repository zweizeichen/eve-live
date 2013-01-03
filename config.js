var config = {};

// Port of th eapplication - can be overwritte by console
config.port = 8000;

// EMDR relays eve-live will connect to
config.relays = ['tcp://relay-us-west-1.eve-emdr.com:8050', 'tcp://relay-us-east-1.eve-emdr.com:8050', 'tcp://relay-eu-germany-1.eve-emdr.com:8050'];

// Display live status
config.displayStatus = true;

// Periodically store DB to redis
config.externalStorage = false;

// Interval in which data is backed-up in milliseconds
config.externalStorageInterval = 300000;

// Redis login credentials
config.redis = {};
config.redis.database = '0';

config.redis.host = '127.0.0.1';
config.redis.port = 6379;

config.redis.authenticate = false;
config.redis.password = '';

module.exports = config;