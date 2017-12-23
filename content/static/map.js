
function HouseMap(storage)
{
    if (!window.location.hash)
    {
        window.location.hash = window.prompt('Name?');

        var newStorage = new DataStore('jampy-public', window.location.hash.substr(1));
        var newData = window.JSON.parse(window.prompt('Data?'));
        if (newData)
        {
            newStorage.set(newData, 'data.json', function () {
                window.location.reload();
            });
        }
        else
            window.location.reload();
    }

    this._storage = storage;
    this._storage.get('data.json', createCallback(this, this._init), function(){
        console.log(arguments);
    });

    this._mapWrapper = $('#MainMap');
    this._map = new google.maps.Map(this._mapWrapper[0], {
        zoom: 16,
        center: {lat: 40.739498, lng: -73.870852}
    });
    this._geocoder = new google.maps.Geocoder();
    this._distancer = new google.maps.DistanceMatrixService();

    this._transitLayer = new google.maps.TransitLayer();
    this._transitLayer.setMap(this._map);

    this._placesService = new google.maps.places.PlacesService(this._map);
    this._directionsService = new google.maps.DirectionsService(this._map);

    this._currentSelection = null;
    this._currentEditedHouse = null;

    this._tempMarker = null;
}

HouseMap.prototype._init = function(data)
{
    for (var i = data.houses.length - 1; i >= 0; i--)
    {
        if (!data.houses[i])
            data.houses.splice(i, 1);
    }

    this._data = data;
    window.data = this._data;
    this._targetLocations = [];
    for (i = 0; i < this._data.targets.length; i++)
        this._targetLocations.push(this._data.targets[i].location);

    // Draw houses
    this._startDrawHouses();

    // Draw targets
    this._drawTargets();

    $('#AddNewWrapper').bind('submit', createCallback(this, this._addNewHouse));
    $('#SaveButton').bind('click', createCallback(this, this._saveHouseChanges));

    this._editWrapper = $('#EditWrapper').detach();

    this._map.addListener('click', createCallback(this, this._onMapClick))
};

HouseMap.prototype._startDrawHouses = function()
{
    for (var i = 0; i < this._data.houses.length; i++)
    {
        var house = this._data.houses[i];
        if (house.address.indexOf('\n') !== -1)
            delim = '\n';
        else
            delim = ',';

        house.title = house.address.substr(0, house.address.indexOf(delim));
        if (!house.location)
        {
            this._geocoder.geocode({
                'address': house.address
            }, createCallback(this, this._onGeocode, [house]));
        }

        this._createMarker(house);
    }
};

HouseMap.prototype._drawTargets = function()
{
    for (var i = 0; i < this._targetLocations.length; i++)
    {
        var targetMarker = new google.maps.Marker({
            position: this._targetLocations[i],
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 4,
                fillOpacity: 0,
                strokeOpacity: 0.7,
                strokeWeight: 3
            },
            draggable: false,
            map: this._map
        });
        targetMarker.addListener('click', createCallback(this, this._onMarkerClick, [null, targetMarker, false]));
    }
};

HouseMap.prototype._onGeocode = function(house, results, status)
{
    if (status !== 'OK')
    {
        console.log('Error geocoding', house);
        return;
    }

    house.location = {
        'lat': results[0].geometry.location.lat(),
        'lng': results[0].geometry.location.lng()
    };
    this._createMarker(house);
    this._displayUpdatedJson(false);
};

HouseMap.prototype._createMarker = function(house)
{
    if (!house.location)
        return;

    var marker = new google.maps.Marker({
        position: house.location,
        map: this._map,
        title: house.title,
        icon: house.forSale ? '/static/marker_green.png' : null
    });
    marker.addListener('click', createCallback(this, this._onMarkerClick, [house, marker, true]));

    // Show price
    new MapLabel({
      text: house.price,
      position: new google.maps.LatLng(house.location.lat, house.location.lng),
      map: this._map,
      fontSize: 11,
      align: 'center'
    });
};

HouseMap.prototype._onMarkerClick = function(house, marker, showTargets, event)
{
    var shouldShow = true;
    if (this._currentSelection)
    {
        if (this._currentSelection.marker === marker)
            shouldShow = false;

        if (this._currentSelection.infoBox)
            this._currentSelection.infoBox.close();
        for (var i = 0; i < this._currentSelection.transitInfo.length; i++)
            this._currentSelection.transitInfo[i].display.setMap(null);
        this._currentSelection = null;
    }

    if (shouldShow)
    {
        var location = house ? house.location : event.latLng;
        this._currentSelection = {
            house: house,
            marker: marker,
            transitInfo: [],
            targetInfo: []
        };

        this._placesService.nearbySearch({
            location: location,
            types: ['subway_station'],
            rankBy: google.maps.places.RankBy.DISTANCE
        }, createCallback(this, this._onTransitPlaces, [location]));

        if (showTargets)
        {
            this._distancer.getDistanceMatrix({
                origins: [location],
                destinations: this._targetLocations,
                travelMode: 'WALKING',
                unitSystem: google.maps.UnitSystem.IMPERIAL
            }, createCallback(this, this._onDistance, [house]));
        }
    }
};

HouseMap.prototype._onMapClick = function(event)
{
    if (this._tempMarker)
        this._tempMarker.setMap(null);

    this._tempMarker = new google.maps.Marker({
        position: event.latLng,
        map: this._map,
        title: 'New location',
        icon: null
    });

    this._onMarkerClick(null, this._tempMarker, true, event);
};

HouseMap.prototype._onTransitPlaces = function(location, results, status)
{
    if (status !== 'OK')
    {
        console.log('Error with places API', location);
        return;
    }

    this._currentSelection.transitCount = Math.min(results.length, 3);

    for (var i = 0; i < this._currentSelection.transitCount; i++)
        this._loadDirections(location, results[i].geometry.location, results[i].name);
};

HouseMap.prototype._loadDirections = function(origin, destination, name)
{
    function onRouteResults(results, status)
    {
        if (status !== 'OK')
            return;

        var display = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            preserveViewport: true
        });
        display.setMap(this._map);
        display.setDirections(results);

        this._currentSelection.transitInfo.push({
            display: display,
            directions: results,
            name: name
        });

        this._displayInfoBoxIfReady();
    }

    this._directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: 'WALKING'
    }, createCallback(this, onRouteResults));
};

HouseMap.prototype._onDistance = function(house, results, status)
{
    if (status !== 'OK')
    {
        console.log('Error with distance', house);
        return;
    }

    this._currentSelection.targetInfo = [];
    for (var i = 0; i < this._data.targets.length; i++)
    {
        this._currentSelection.targetInfo.push({
            name: this._data.targets[i].name,
            distance: results.rows[0].elements[i]
        });
    }

    this._displayInfoBoxIfReady();
};

HouseMap.prototype._displayInfoBoxIfReady = function()
{
    if (this._currentSelection.transitInfo.length !== this._currentSelection.transitCount)
        return;

    if (this._currentSelection.house &&
        this._currentSelection.targetInfo.length !== this._targetLocations.length)
    {
        return;
    }

    this._displayInfoBox();
};

function round(number, decimalPlaces)
{
    var factor = Math.pow(10, decimalPlaces);
    return Math.round(number * factor) / factor;
}

function getDistDesc(dist)
{
    return round(dist * 0.000621371, 3) + ' mi';
}

HouseMap.prototype._displayInfoBox = function()
{
    var house = this._currentSelection.house;
    var desc = '';
    if (house)
    {
        desc += house.address.replace(', ', '\n').replace(',', '\n');
        desc += '\n\n' + house.notes + '\n';
        desc += 'Price: $' + house.price + '\n';
    }
    for (var i = 0; i < this._currentSelection.targetInfo.length; i++)
    {
        desc += this._currentSelection.targetInfo[i].name + ': ';
        desc += getDistDesc(this._currentSelection.targetInfo[i].distance.distance.value) + '\n';
    }

    desc += '\n';
    for (i = 0; i < this._currentSelection.transitInfo.length; i++)
    {
        desc += this._currentSelection.transitInfo[i].name + ': ';
        desc += getDistDesc(this._currentSelection.transitInfo[i].directions.routes[0].legs[0].distance.value) + '\n';
    }

    var oElem = $(document.createDocumentFragment()).appendNewChild('DIV');
    oElem.text(desc);
    oElem.css({'white-space': 'pre'});

    if (house)
    {
        var deleteButton = oElem.appendNewChild('BUTTON', '', 'btn btn-danger btn-tiny');
        deleteButton.text('Delete');
        deleteButton.bind('click', createCallback(this, this._deleteHouse, [house]));
        deleteButton.css('float', 'right');

        var editButton = oElem.appendNewChild('BUTTON', '', 'btn btn-default btn-tiny');
        editButton.text('Edit');
        editButton.bind('click', createCallback(this, this._editHouse, [house]));
    }

    var info = new google.maps.InfoWindow({
        content: oElem[0]
    });

    this._currentSelection.infoBox = info;
    info.open(this._map, this._currentSelection.marker);
};

HouseMap.prototype._deleteHouse = function(house)
{
    for (var i = 0; i < this._data.houses.length; i++)
    {
        if (this._data.houses[i].address === house.address)
        {
            delete this._data.houses[i];
            break;
        }
    }
    this._displayUpdatedJson(true);
};

HouseMap.prototype._editHouse = function(house)
{
    this._currentEditedHouse = house;

    $.featherlight(this._editWrapper);

    $('#EditAddressInput').val(house.address.replace('\n', ', '));
    $('#EditPriceInput').val(house.price);
    $('#EditNotesInput').val(house.notes);
    $('#EditForSaleCheck')[0].checked = house.forSale;
};

HouseMap.prototype._saveHouseChanges = function()
{
    if (!this._currentEditedHouse)
        return;

    for (var i = 0; i < this._data.houses.length; i++)
    {
        if (this._data.houses[i].address === this._currentEditedHouse.address)
        {
            this._data.houses[i].address = $('#EditAddressInput').val();
            this._data.houses[i].price = $('#EditPriceInput').val();
            this._data.houses[i].notes = $('#EditNotesInput').val();
            this._data.houses[i].forSale = $('#EditForSaleCheck')[0].checked;

            this._displayUpdatedJson(true);
        }
    }
};

HouseMap.prototype._displayUpdatedJson = function(shouldReload)
{
    this._storage.set(this._data, 'data.json', function()
    {
        if (shouldReload)
            window.location.reload();
    }, function()
    {
        console.log(arguments);
    });
};

HouseMap.prototype._addNewHouse = function(event)
{
    var house = {
        address: $('#NewAddressInput').val(),
        price: $('#NewPriceInput').val(),
        notes: $('#NewNotesInput').val(),
        forSale: $('#NewForSaleCheck')[0].checked
    };
    this._data.houses.push(house);

    this._geocoder.geocode({
        'address': house.address
    }, createCallback(this, this._onGeocode, [house]));

    event.preventDefault();
    return false;
};


function initMap()
{
    var storage = new DataStore('jampy-public', window.location.hash.substr(1));
    var map = new HouseMap(storage);
}
