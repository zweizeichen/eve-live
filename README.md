# EVELive - Real-Time Pricing Data

## Overview

EVELive is a simple NodeJS application based on Socket.io and the Express 3 framework. 
It allows subscription to the EVE Market Data Relay (EMDR) to provide the user with global real-time pricing data. This allows the creation of real-time info panels or very accurate spreadsheets. All data is stored in RAM so it can be retrieved extremely fast and there is no need for an external database. Nevertheless it is possible to frequently write the internal database to a Redis instance to allow persistence between restarts.

Pricing information can be retrieved in three different ways:

* The built-in web interface
* A JSON API
* WebSockets / Socket.io

## Installation
Make sure you have `node`, `npm`,  `libzmq` and `libuuid` installed before proceeding.

* `git clone` this repository
* Run `npm install`
* Configure the app by editing `config.js`
* Run `node app` to run eve-live

## Accessing the Web Interface
Just open your favorite web browser and access the host eve-live is running on on the port you specified in `config.js`

## Retrieving Data from the JSON API
### Type Snapshot
Syntax:  `/snapshot/[solarSystemID]/[typeID]/`  
Description: This will return a JSON document containing pricing information of that type in the selected system. `generatedAt` specifies the time the price was last seen.  
Example: 
`/snapshot/30000142/34/`
```javascript
{
  "ask":5.99,
  "bid":6,
  "generatedAt":1357220569000
}
```

### System Snapshot
Syntax:  `/snapshot/[solarSystemID]/`  
Description: This will return a JSON document containing all types and their prices in the selected system. `generatedAt` specifies the time the price was last seen.  
Example: 
`/snapshot/30000142/`
```javascript
    {
      [...]
      "34": {
        "ask": 5.99,
        "bid": 6,
        "generatedAt": 1357220281000
      },
      "35": {
        "ask": 13.7,
        "bid": 13.69,
        "generatedAt": 1357220230000
      },
      "36": {
        "ask": 54.72,
        "bid": 54.41,
        "generatedAt": 1357220213000
      },
      "37": {
        "ask": 157.96,
        "bid": 156,
        "generatedAt": 1357220299000
      },
      [...]
    }
```
## Using Socket.io to Receive real-time Data from EVELive
EVELive allows clients using Socket.io to subscribe to different rooms representing all the solar systems of EVE Online. Each system has two rooms:  

* `[solarSystemID]`
* `[solarSystemID]-realtime`

Once the client connects to a room it receives the `init`event with the current system snapshot. If the client subscribed to the first room, it will only receive `update` events if the actual prices got updated. If the client connected to the `[solarSystemID]-realtime` room, it will receive updates whenever `generatedAt` gets updated even if the prices did not change at all. The data structure obtained from the `update` event is similar to the structure of the type snapshot:
```javascript
{
  "34": {
    "ask": 5.99,
    "bid": 6,
    "generatedAt": 1357220569000
  }
}
```

Client example:  
```javascript
// Sockets
var socket = io.connect(window.location.hostname);
var room = '30000142-realtime';

// Local representation of the prices database and other variables
var localPrices = {};
var localNames = {};

// Subscribe to Jita realtime feed
socket.emit('subscribe', {
  room: room
});

// Load initial database
socket.on('init', function(data) {
	localPrices = data;
});

// On update update local DB
socket.on('update', function(data) {
	// Update local DB
	for(var type in data) {
		localPrices[type] = data[type];
		console.log('Updated type ' + type + '.');
	}
});
```
Another example can be found in `/public/javascripts/main.js`
