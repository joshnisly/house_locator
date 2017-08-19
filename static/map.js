
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
        new google.maps.Circle({
            center: this._targetLocations[i],
            radius: 10,
            fillOpacity: 0,
            strokeColor: '#333',
            strokeOpacity: 0.5,
            strokeWeight: 2,
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
        title: house.title
    });

    if (house.notes)
    {
        var oElem = $(document.createDocumentFragment()).appendNewChild('DIV');
        oElem.text(house.notes);
        var info = new google.maps.InfoWindow({
            content: '<div>' + house.notes + '</div>'
        });
        marker.addListener('click', createCallback(this, function() {
            info.open(this._map, marker);
        }));
    }
};

HouseMap.prototype._displayUpdatedJson = function()
{
    var json = window.JSON.stringify(this._data, null, '    ');
    // var elem = $(this._mapWrapper[0].parentNode).appendNewChild('DIV', 'JsonDisplay').text(json);
    // window.getSelection().selectAllChildren(elem[0]);
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
