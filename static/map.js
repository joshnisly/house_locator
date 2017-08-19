
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


    // Draw houses
    for (var i = 0; i < this._data.houses.length; i++)
    {
        var house = this._data.houses[i];
        if (house.address.indexOf('\n') != -1)
            delim = '\n';
        else
            delim = ',';

        house.title = house.address.substr(0, house.address.indexOf(delim));
        if (house.location)
            this._createMarker(house);
        else
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
    }

    // Draw targets
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

    $('#AddNewWrapper').bind('submit', createCallback(this, this._addNewHouse));
}

HouseMap.prototype._onGeocode = function(house, results, status)
{
    if (status != 'OK')
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
    if (status != 'OK')
    {
        console.log('Error with distance', house);
        return;
    }

    house.distance = {};
    for (var i = 0; i < this._data.targets.length; i++)
    {
        house.distance[this._data.targets[i].name] = results.rows[0].elements[i];
    }
    this._displayUpdatedJson();
};

HouseMap.prototype._createMarker = function(house)
{
    var marker = new google.maps.Marker({
        position: house.location,
        map: this._map,
        title: house.title,
        icon: house.forSale ? '/static/marker_green.png' : null
    });

    var desc = house.address.replace(', ', '\n').replace(',', '\n');
    desc += '\n\n' + house.notes + '\n';
    desc += 'Price: $' + house.price + 'K\n';
    for (var target in house.distance)
        desc += target + ': ' + house.distance[target].distance.text + ' (' + house.distance[target].duration.text + ')\n';

    var oElem = $(document.createDocumentFragment()).appendNewChild('DIV');
    oElem.text(desc);
    oElem.css({'white-space': 'pre'});
    var info = new google.maps.InfoWindow({
        content: oElem[0]
    });
    marker.addListener('click', createCallback(this, function() {
        if (marker.isOpen)
            info.close();
        else
            info.open(this._map, marker);
        marker.isOpen = !!!marker.isOpen;
    }));
    //marker.addListener('dblclick', createCallback(this, function() { window.alert('Hey!'); }));

    var mapLabel = new MapLabel({
      text: house.price,
      position: new google.maps.LatLng(house.location.lat, house.location.lng),
      map: this._map,
      fontSize: 11,
      align: 'center'
    });
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
