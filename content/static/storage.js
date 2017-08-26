function DataStore(bucket, prefix)
{
    this._bucket = bucket;
    this._prefix = prefix;
    this._s3 = new AWS.S3({apiVersion: '2006-03-01'});
}
DataStore.prototype.get = function(name, onsuccess, onerror)
{
    this._unauthenticatedRequest('getObject', {
        Bucket: this._bucket,
        Key: this._prefix + name
    }, function(err, data) {
        if (err)
            onerror(err);
        else
            onsuccess(window.JSON.parse(data.Body + ''));
    })
};
DataStore.prototype.set = function(data, name, onsuccess, onerror)
{
    this._unauthenticatedRequest('putObject', {
        Body: window.JSON.stringify(data),
        Bucket: this._bucket,
        Key: this._prefix + name
    }, function(err) {
        if (err)
            onerror(err);
        else
            onsuccess();
    })
};

DataStore.prototype._unauthenticatedRequest = function(operation, params, callback)
{
  var request = this._s3[operation](params);
  request.removeListener('validate', AWS.EventListeners.Core.VALIDATE_CREDENTIALS);
  request.removeListener('sign', AWS.EventListeners.Core.SIGN);
  request.send(callback);
};
