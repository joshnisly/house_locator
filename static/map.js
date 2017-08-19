
function HouseMap(data)
{
    this._data = data;

    this._mapWrapper = $('#MainMap');
    this._map = new google.maps.Map(this._mapWrapper[0], {
        zoom: 16,
        center: {lat: 40.739498, lng: -73.870852}
    });
    this._geocoder = new google.maps.Geocoder();

    for (var i = 0; i < this._data.houses.length; i++)
    {
        var house = this._data.houses[i];
        if (house.location)
            this._createMarker(house.location);
        else
        {
            this._geocoder.geocode({
                'address': this._data.houses[i].address
            }, createCallback(this, this._onGeocode, [this._data.houses[i]]));
        }
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
    this._createMarker(house.location);
    this._displayUpdatedJson();
};

HouseMap.prototype._createMarker = function(position)
{
    var marker = new google.maps.Marker({
        position: position,
        map: this._map
    });
};

HouseMap.prototype._displayUpdatedJson = function()
{
    var json = window.JSON.stringify(this._data, null, '    ');
    var elem = $(this._mapWrapper[0].parentNode).appendNewChild('DIV', 'JsonDisplay').text(json);
    window.getSelection().selectAllChildren(elem[0]);
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

    console.log(house);
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
