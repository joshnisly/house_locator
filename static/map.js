
function HouseMap(data)
{
    this._data = data;
    window.data = data;
    this._targetLocations = [];
    for (var i = 0; i < this._data.targets.length; i++)
        this._targetLocations.push(this._data.targets[i].location);

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


    // Draw houses
    this._startDrawHouses();

    // Draw targets
    this._drawTargets();

    $('#AddNewWrapper').bind('submit', createCallback(this, this._addNewHouse));
}

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

        if (!house.distance)
        {
            this._distancer.getDistanceMatrix({
                origins: [house.location],
                destinations: this._targetLocations,
                travelMode: 'WALKING',
                unitSystem: google.maps.UnitSystem.IMPERIAL
            }, createCallback(this, this._onDistance, [house]));
        }

        this._createMarker(house);
    }
};

HouseMap.prototype._drawTargets = function()
{
    for (i = 0; i < this._targetLocations.length; i++)
    {
        new google.maps.Marker({
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
    }
};

HouseMap.prototype._onGeocode = function(house, results, status)
{
    if (status !== 'OK')
    {
        console.log('Error geocoding', house);
        return;
    }

    house.location = results[0].geometry.location;
    this._createMarker(house);
    this._displayUpdatedJson();
};

HouseMap.prototype._onDistance = function(house, results, status)
{
    if (status !== 'OK')
    {
        console.log('Error with distance', house);
        return;
    }

    house.distance = {};
    for (var i = 0; i < this._data.targets.length; i++)
        house.distance[this._data.targets[i].name] = results.rows[0].elements[i];

    this._createMarker(house);
    this._displayUpdatedJson();
};

HouseMap.prototype._createMarker = function(house)
{
    if (!house.location || !house.distance)
        return;

    var marker = new google.maps.Marker({
        position: house.location,
        map: this._map,
        title: house.title,
        icon: house.forSale ? '/static/marker_green.png' : null
    });
    marker.addListener('click', createCallback(this, this._onMarkerClick, [house, marker]));

    // Show price
    new MapLabel({
      text: house.price,
      position: new google.maps.LatLng(house.location.lat, house.location.lng),
      map: this._map,
      fontSize: 11,
      align: 'center'
    });
};

HouseMap.prototype._onMarkerClick = function(house, marker)
{
    var shouldShow = true;
    if (this._currentSelection)
    {
        if (this._currentSelection.marker === marker)
            shouldShow = false;

        if (this._currentSelection.infoBox)
            this._currentSelection.infoBox.close();
        for (var i = 0; i < this._currentSelection.transitDirections.length; i++)
            this._currentSelection.transitDisplays[i].setMap(null);
        this._currentSelection = null;
    }

    if (shouldShow)
    {
        this._currentSelection = {
            house: house,
            marker: marker,
            transitDisplays: [],
            transitDirections: []
        };

        this._placesService.nearbySearch({
            location: house.location,
            types: ['subway_station'],
            rankBy: google.maps.places.RankBy.DISTANCE
        }, createCallback(this, this._onTransitPlaces, [house]));
    }
};

HouseMap.prototype._onTransitPlaces = function(house, results, status)
{
    if (status !== 'OK')
    {
        console.log('Error with places API', house);
        return;
    }

    this._currentSelection.transitCount = Math.min(results.length, 3);

    for (var i = 0; i < this._currentSelection.transitCount; i++)
        this._loadDirections(house.location, results[i].geometry.location, i);
};

HouseMap.prototype._loadDirections = function(origin, destination, index)
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

        this._currentSelection.transitDisplays.push(display);
        this._currentSelection.transitDirections.push(results);

        this._displayInfoBoxIfReady();
    }

    this._directionsService.route({
        origin: origin,
        destination: destination,
        travelMode: 'WALKING'
    }, createCallback(this, onRouteResults));
};
HouseMap.prototype._displayInfoBoxIfReady = function()
{
    if (this._currentSelection.transitDirections.length === this._currentSelection.transitCount)
        this._displayInfoBox();
};

HouseMap.prototype._displayInfoBox = function()
{
    var house = this._currentSelection.house;
    var desc = house.address.replace(', ', '\n').replace(',', '\n');
    desc += '\n\n' + house.notes + '\n';
    desc += 'Price: $' + house.price + 'K\n';
    for (var target in house.distance)
        desc += target + ': ' + house.distance[target].distance.text + '\n';

    desc += '\n';
    for (var i = 0; i < this._currentSelection.transitDirections.length; i++)
        desc += this._formatDirectionsDesc(this._currentSelection.transitDirections[i]) + '\n';

    var oElem = $(document.createDocumentFragment()).appendNewChild('DIV');
    oElem.text(desc);
    oElem.css({'white-space': 'pre'});
    var info = new google.maps.InfoWindow({
        content: oElem[0]
    });

    this._currentSelection.infoBox = info;
    info.open(this._map, this._currentSelection.marker);
};

HouseMap.prototype._formatDirectionsDesc = function(directions)
{
    console.log(directions);
    return directions.routes[0].summary + ': ' + directions.routes[0].legs[0].distance.text;
};

HouseMap.prototype._displayUpdatedJson = function()
{
    var json = window.JSON.stringify(this._data, null, '    ');
    $.ajax({
        'url': '/update/',
        'data': json,
        'dataType': 'json',
        'method': 'POST',
        'contentType': 'application/json'
    })
};

HouseMap.prototype._addNewHouse = function(event)
{
    var house = {
        address: $('#NewAddressInput').val(),
        price: $('#NewPriceInput').val() + 0,
        notes: $('#NewNotesInput').val()
    };
    this._data.houses.push(house);

    this._geocoder.geocode({
        'address': house.address
    }, createCallback(this, this._onGeocode, [house]));

    event.preventDefault();
    return false;
};


function initMap() {

    var data = window.JSON.parse($('#MainMap').attr('xdata'));
    var map = new HouseMap(data);
}
