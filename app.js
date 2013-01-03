/*
 * eve-live Application
 */

// Load global configuration
var config = require('./config');

// Load deps
var express = require('express'),
  routes = require('./routes'),
  http = require('http'),
  path = require('path'),
  zmq = require('zmq'),
  zlib = require('zlib'),
  colors = require('colors'),
  zmqSocket = zmq.socket('sub');

var app = express();

// Main DB
var prices = {};

// Stats
var messagesTotal = 0;
var messagesOrders = 0;
var dataUpdated = 0;

// Block STDOUT?
var outBlocked = false;

/*
 * Express Setup
 */

app.configure(function() {
  app.set('port', process.env.PORT || config.port);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.compress());
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function() {
  app.use(express.errorHandler());
});

app.get('/', routes.index);

// Return market snapshot of this system
app.get('/snapshot/:system/', function(req, res) {

  var response = JSON.stringify(prices[req.params.system]);
  if(response === undefined) {
    response = '{error: "No data for this system. Is the ID correct?"}';
  }

  res.write(response);
  res.end();
});

// Return market snapshot of that type in this system
app.get('/snapshot/:system/:type/', function(req, res) {

  var response = JSON.stringify(prices[req.params.system][req.params.type]);
  if(response === undefined) {
    response = '{error: "No data for that type in this system. Are the IDs correct?"}';
  }

  res.write(response);
  res.end();
});

/*
 *  WebSockets
 */

var server = app.listen(app.get('port'));
var io = require('socket.io').listen(server);
io.set('log level', 1);

io.sockets.on('connection', function(socket) {

  // On connection emit current DB of that system
  socket.on('subscribe', function(data) {
    socket.emit('init', prices[String(data.room).replace('-realtime', '')]);

    socket.join(data.room);
  });

  // Remove from room when client unsubscribed
  socket.on('unsubscribe', function(data) {
    socket.leave(data.room);
  });

});


/*
 *  eve-live server
 */
console.log('                                       /$$ /$$                    ');
console.log('                                      | $$|__/                    ');
console.log('  /$$$$$$  /$$    /$$ /$$$$$$         | $$ /$$ /$$    /$$ /$$$$$$ ');
console.log(' /$$__  $$|  $$  /$$//$$__  $$ /$$$$$$| $$| $$|  $$  /$$//$$__  $$');
console.log('| $$$$$$$$ \\  $$/$$/| $$$$$$$$|______/| $$| $$ \\  $$/$$/| $$$$$$$$');
console.log('| $$_____/  \\  $$$/ | $$_____/        | $$| $$  \\  $$$/ | $$_____/');
console.log('|  $$$$$$$   \\  $/  |  $$$$$$$        | $$| $$   \\  $/  |  $$$$$$$');
console.log(' \\_______/    \\_/    \\_______/        |__/|__/    \\_/    \\_______/ v1.0');

// Connect to the relays specified in the config file
for(var relay in config.relays) {
  process.stdout.write('Connecting to ' + config.relays[relay].underline + ':');

  // Connect to the relay.
  zmqSocket.connect(config.relays[relay]);

  console.log(' OK!'.green);
}

// External storage functionality
if(config.externalStorage) {
  redis = require("redis").createClient(config.redis.port, config.redis.host);

  redis.on("error", function(err) {
    console.log("Redis error: " + err);
  });
}

function redisAuthenticate() {
  // Authenticate at server
  process.stdout.write('Authenticating at Redis server: ');
  redis.auth(config.redis.password, redisSelectDatabase());
}

function redisSelectDatabase() {

  // If client had to authenticate and the app has not crashed everything must have went fine
  if(config.redis.authenticate) {
    console.log('OK!'.green);
  }

  // Select proper DB
  process.stdout.write('Selecting Redis database: ');
  redis.select(config.redis.database, redisLoadDatabase());
}

function redisLoadDatabase() {
  // Load database from Redis
  console.log('OK!'.green);
  process.stdout.write('Loading database from Redis: ');

  redis.get('eve-live-db', function(err, reply) {
    if(reply === null) {
      console.log('Key is missing!'.yellow);
    } else {
      prices = JSON.parse(reply);
      console.log('OK!'.green);
    }

    outBlocked = false;
  });
}

// Kick-off external storage initialization
if(config.externalStorage) {

  outBlocked = true;

  if(config.redis.authenticate) {
    redisAuthenticate();
  } else {
    redisSelectDatabase();
  }

}

// Disable filtering
zmqSocket.subscribe('');

// Message Handling
zmqSocket.on('error', function(error) {
  console.log('ERROR: ' + error);
});

// ZeroMQ Socket event handling
zmqSocket.on('message', function(message) {
  // Receive raw market JSON strings.
  zlib.inflate(message, function(error, marketJSON) {

    // Parse the JSON data.
    var marketData = JSON.parse(marketJSON);

    // Increase message counter
    messagesTotal++;

    // If we got orders parse prices
    if(marketData.resultType == 'orders') {

      // Increase message counter
      messagesOrders++;

      var priceIndex = marketData.columns.indexOf('price');
      var solarSystemIndex = marketData.columns.indexOf('solarSystemID');
      var isBidIndex = marketData.columns.indexOf('bid');

      // Fill value array if there are any rows
      for(var rowset in marketData.rowsets) {

        var bid = 0;
        var ask = 0;
        var oldDate = 0;

        var typeID = marketData.rowsets[rowset].typeID;
        var generatedAt = Date.parse(marketData.rowsets[rowset].generatedAt);

        var solarSystemsAffected = {};

        // Traverse through data structure
        for(var row in marketData.rowsets[rowset].rows) {

          var price = marketData.rowsets[rowset].rows[row][priceIndex];
          var isBid = marketData.rowsets[rowset].rows[row][isBidIndex];
          var solarSystemID = marketData.rowsets[rowset].rows[row][solarSystemIndex];

          bid = 0;
          ask = 0;
          oldDate = 0;

          // Try reading those values or initialize data structure
          if(!prices[solarSystemID]) {
            prices[solarSystemID] = {};
            prices[solarSystemID][typeID] = {};
            prices[solarSystemID][typeID].ask = ask;
            prices[solarSystemID][typeID].bid = bid;
            prices[solarSystemID][typeID].generatedAt = oldDate;

          } else if(!prices[solarSystemID][typeID]) {
            prices[solarSystemID][typeID] = {};
            prices[solarSystemID][typeID].ask = ask;
            prices[solarSystemID][typeID].bid = bid;
            prices[solarSystemID][typeID].generatedAt = oldDate;
          }

          bid = prices[solarSystemID][typeID].bid;
          ask = prices[solarSystemID][typeID].ask;
          oldDate = prices[solarSystemID][typeID].generatedAt;

          // Check if there's new data
          // On first run reset prices
          if(oldDate < generatedAt) {
            bid = 0;
            ask = 0;
            dataUpdated++;

            // Determine if we have to update the values
            oldBid = prices[solarSystemID][typeID].bid;
            oldAsk = prices[solarSystemID][typeID].ask;

            // Add system to list of updated systems
            if(Object.keys(solarSystemsAffected).indexOf(solarSystemID) == -1) {
              solarSystemsAffected[solarSystemID] = {
                bid: oldBid,
                ask: oldAsk
              };
            }
          }

          // Update accordingly
          if(oldDate <= generatedAt) {

            // Switch based on ask/bid
            if(isBid === true) {

              if(price > bid || bid === 0) {
                prices[solarSystemID][typeID].bid = price;
              }

            } else if(isBid === false) {

              if(price < ask || ask === 0) {
                prices[solarSystemID][typeID].ask = price;
              }

            }

            prices[solarSystemID][typeID].generatedAt = generatedAt;
          }
        }

        // After new data got added, trigger update events for the systems
        for(var system in solarSystemsAffected) {
          var response = {};
          response[typeID] = prices[system][typeID];

          // Emit time and price update to real-time clients
          io.sockets. in (system + '-realtime').emit('update', response);

          // Only send data to non-real-time clients if we actually updated something apart form generatedAt
          if((prices[system][typeID].bid != solarSystemsAffected[system].bid) || (prices[system][typeID].ask != solarSystemsAffected[system].ask)) {
            io.sockets. in (system).emit('update', response);
          }
        }
      }
    }
  });
});

// Reconnect
// Voodoo code makes the zmq socket stay open
// Otherwise it would get removed by the garbage collection
setTimeout(function() {
  if(false) {
    zmqSocket.connect(relay);
  }
}, 1000 * 60 * 60 * 24 * 365);

/*
 * Status Display
 */

// Status
if(config.displayStatus) {
  setInterval(function() {
    if(!outBlocked) {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      now = new Date(Date.now());
      process.stdout.write('[' + now.toLocaleTimeString() + '] There are currently ' + String(Object.keys(prices).length) + ' systems in our DB. Receiving ' + messagesTotal / 0.5 + ' messages per second (H: ' + (messagesTotal - messagesOrders) / 0.5 + ' / O: ' + messagesOrders / 0.5 + ' / U: ' + dataUpdated / 0.5 + ').');
    }
    messagesTotal = 0;
    messagesOrders = 0;
    dataUpdated = 0;
  }, 500);
}

// DB writer
if(config.externalStorage) {
  setInterval(function() {
    now = new Date(Date.now());
    process.stdout.write('\n[' + now.toLocaleTimeString() + '] Writing DB to Redis: ');
    outBlocked = true;
    redis.set('eve-live-db', JSON.stringify(prices), function(err, reply) {
      console.log('OK!'.green);
      outBlocked = false;
    });
  }, config.externalStorageInterval);
}