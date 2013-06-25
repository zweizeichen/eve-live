var socket = io.connect(window.location.hostname);
var room = '30000142-realtime';
var currentSystem = 30000142;

// Local representation of the prices database and other variables
var localPrices = {};
var localNames = {};

// Types we're watching at the moment
var watching = [];

socket.emit('subscribe', {
	room: room
});

socket.on('init', function(data) {
	localPrices = data;
	$('#modal-system').modal('hide');

	var node = $("#tree").dynatree("getActiveNode");
	if(node !== null) {
		node.deactivate();
		node.activate();
	}
});

function updatePrice(element, type, price) {

	var oldPrice = parseFloat(element.attr('data-isk'));

	// Pulse values on change
	if(oldPrice > price && element.attr('style') === undefined) {
		// If new value is smaller, pulse red, remove style left over from the pulse afterwards
		element.text(String(price).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"));
		element.attr('data-isk', price);
		element.pulse({
			'background-color': '#f2dede'
		}, {
			duration: 200
		}, function() {
			element.removeAttr("style");
		});
	}

	if(oldPrice < price && element.attr('style') === undefined) {
		// If new value is higher, pulse green, remove style left over from the pulse afterwards
		element.text(String(price).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,"));
		element.attr('data-isk', price);
		element.pulse({
			'background-color': '#dff0d8'
		}, {
			duration: 200
		}, function() {
			element.removeAttr("style");
		});
	}
}

socket.on('update', function(data) {
	// Update local DB
	for(var type in data) {
		localPrices[type] = data[type];

		// Pulse activity indicator
		if($('#update-dot').attr('style') === undefined){
			$('#update-dot').pulse({
			'color': 'green'
			}, {
				duration: 200
			}, function() {
				$('#update-dot').removeAttr("style");
			});

      $('#last-updated').text(localNames[type]);
		}

		// Update table if type is on watchlist
		if(watching.indexOf(parseInt(type, 10)) != -1) {

			updatePrice($('#bid-' + type), type, localPrices[type].bid);
			updatePrice($('#ask-' + type), type, localPrices[type].ask);

			// Update timers
			var dateISO = new Date(localPrices[type].generatedAt).toISOString();
			$('#time-' + type).attr('datetime', dateISO);

			// Reinit timeago
			$('#time-' + type).data("timeago", null).timeago();
		}
	}
});

// Get invType Names
$.getJSON('/javascripts/names.json', function(names) {
	localNames = names;
});

// Get market groups and initialize tree
$.getJSON('/javascripts/groups.json', function(groups) {
	$('#tree').dynatree({
		title: "market",
		// Tree's name
		autoCollapse: true,
		// Auto-collapse other branches
		imagePath: " ",
		// Path to a folder containing icons.
		fx: {
			height: "toggle",
			duration: 200
		},
		children: groups,
		onActivate: function(node) {
			if(!node.data.isFolder) {

				// Clear table and update watchlist
				$('#main-table').fadeOut(200, function() {
					$('#main-table > tbody').empty();
					watching = node.data.types;

					for(var type in node.data.types) {
						var typeID = node.data.types[type];
						var dateISO = new Date();

						// Append new types to table
						if(localPrices[typeID] !== undefined) {
							dateISO = new Date(localPrices[typeID].generatedAt).toISOString();
							$('#main-table > tbody:last').append('<tr><td><img src="//image.eveonline.com/Type/' + typeID + '_32.png" style="margin-right: 5px;"><span>' + localNames[typeID] + '</span></td><td id="bid-' + typeID + '" class="price" data-isk="' + localPrices[typeID].bid + '">' + String(localPrices[typeID].bid).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + '</td><td id="ask-' + typeID + '" class="price" data-isk="' + localPrices[typeID].ask + '">' + String(localPrices[typeID].ask).replace(/(\d)(?=(\d\d\d)+(?!\d))/g, "$1,") + '</td><td class="price"><time id="time-' + typeID + '" class="timeago" datetime="' + dateISO + '"></time></td><td class="price"><a href="snapshot/' + currentSystem + '/' + typeID + '/" target="_blank"><i class="icon-camera" style="margin-top: 2px;"></i></a><a href="//element-43.com/market/' + typeID + '/" target="_blank" style="margin-left: 5px;"><img src="images/e43.png"></a><a href="//www.eve-central.com/home/quicklook.html?typeid=' + typeID + '" target="_blank" style="margin-left: 5px;"><img src="images/ec.png"></a></td></tr>');

							// Init timeago
							$('#time-' + typeID).timeago();
						} else {
							dateISO = new Date(Date.now()).toISOString();
							$('#main-table > tbody:last').append('<tr><td><img src="//image.eveonline.com/Type/' + typeID + '_32.png" style="margin-right: 5px;"><span>' + localNames[typeID] + '</span></td><td id="bid-' + typeID + '" class="price" data-isk="0">No Data</td><td id="ask-' + typeID + '" class="price" data-isk="0">No Data</td><td class="price"><time id="time-' + typeID + '" class="timeago" datetime="' + dateISO + '"></time></td><td class="price"><a href="//element-43.com/market/' + typeID + '/" target="_blank"><img src="images/e43.png"></a><a href="//www.eve-central.com/home/quicklook.html?typeid=' + typeID + '" target="_blank" style="margin-left: 5px;"><img src="images/ec.png"></a></td></tr>');

							// Init timeago
							$('#time-' + typeID).timeago();
						}
					}
				});
				$('#main-table').fadeIn(400);
			}
		},
		onPostInit: function(isReloading, isError) {
			// Auto-activate minerals
			this.activateKey(18);
		}
	});
});

// System modal

function getKeyByValue(object, value) {
	for(var prop in object) {
		if(object.hasOwnProperty(prop)) {
			if(object[prop] === value) return prop;
		}
	}
}

$(document).ready(function() {
	var localSystems = [];

	// Initialize modal properly
	$('#modal-system').on('show', function() {

		if(localSystems.length === 0) {
			$('#modal-system-process-info').show();
			$('#modal-system-typeahead').hide();
			populateSystemTypeahead();
		} else {
			$('#modal-system-process-info').hide();
			$('#modal-system-typeahead').show();
		}

	});

	// When content of typeahead changes, check if it's a valid name and (de)activate button accordingly

	function typeaheadChangeHandler(event) {
		if(getKeyByValue(localSystems, $(this).val()) !== undefined) {
			$('#system-modal-save').removeClass('disabled');
		} else {
			$('#system-modal-save').addClass('disabled');
		}

		if(event.keyCode == 13) {
			validateSave();
		}
	}

	$('#modal-system-typeahead').keyup(typeaheadChangeHandler);
	$('#modal-system-typeahead').change(typeaheadChangeHandler);

	// Only update if we have a proper system selected
	$('#system-modal-save').click(validateSave);

	function validateSave() {
		if(!$('#system-modal-save').hasClass('disabled')) {
			changeSystem(getKeyByValue(localSystems, $('#modal-system-typeahead').val()));
		}
	}

	function populateSystemTypeahead() {
		$.getJSON('/javascripts/systems.json', function(systems) {
			localSystems = systems;

			var systemNames = [];

			// Collect names
			for(var name in localSystems) {
				systemNames.push(localSystems[name]);
			}

			var typeaheadOptions = {
				source: systemNames,
				items: 8
			};

			$('#modal-system-typeahead').typeahead(typeaheadOptions);

			$('#modal-system-process-info').hide();
			$('#modal-system-typeahead').show();
		});
	}


	function changeSystem(systemID) {
		$('#system-modal-save').addClass('disabled');
		$('#modal-system-status').text('Unsubscribing feed...');
		$('#modal-system-process-info').show();
		$('#modal-system-typeahead').hide();

		socket.emit('unsubscribe', {
			room: room
		});

		$('#modal-system-status').text('Clearing local cache...');
		localPrices = {};
		$('#main-table > tbody').empty();

		$('#modal-system-status').text('Subscribing new feed...');
		room = systemID + '-realtime';

		socket.emit('subscribe', {
			room: room
		});

    currentSystem = systemID;

		$('#modal-system-status').text('Loading new price database for ' + localSystems[systemID] + '...');
		$('#system-button').text(localSystems[systemID]);
    $('#api-system').attr('href', '/snapshot/' + systemID + '/');
	}
});