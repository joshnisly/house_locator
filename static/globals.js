function createCallback(oObject, callback, aArgumentsOverride)
{
    return function()
        {
            // If we have both normal arguments and an arguments override, pass in the normal arguments at the end
            if (aArgumentsOverride)
            {
                // Copy arguments array, so that the array is not affected for the next call.
                aArgumentsOverride = aArgumentsOverride.concat([]);
                for (var i = 0; i < arguments.length; i++)
                    aArgumentsOverride.push(arguments[i]);
            }

            return callback.apply(oObject, aArgumentsOverride || arguments);
        };
}

function createElem(tagName, id, className)
{
    var elem = $(document.createElement(tagName));
    if (id)
        elem.attr('id', id);
    if (className)
        elem.addClass(className);
    return elem;
}


$.fn.appendNewChild = function(tagName, id, className)
{
    var aNewItems = [];
    this.each(function(index, elem) {
        var newElem = createElem(tagName, id, className)[0];
        if (id)
            newElem.id = id;
        if (className)
            newElem.className = className;
        elem.appendChild(newElem);
        aNewItems.push(newElem);
    });
    return $(aNewItems);
};