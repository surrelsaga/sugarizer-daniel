define(["sugar-web/graphics/palette","text!shapepalette.html"], function(palette, template) {

    var shapepalette = {};

    shapepalette.ShapePalette = function(invoker, primaryText) {
        // Call parent constructor - wires up popup toggle on button click
        palette.Palette.call(this, invoker, primaryText);

        // Load the HTML template into the palette
        var containerElem = document.createElement('div');
        containerElem.innerHTML = template;
        this.setContent([containerElem]);

        //Create a custom event to change shape
        this.shapeChangeEvent = document.createEvent('CustomEvent'); //similar to add a key-value pair to the Object
        //This initialize the event with a name (read about initCustomEvent)
        this.shapeChangeEvent.initCustomEvent('shapeChange', true, true, { shape: '' });

        //Attach event listeners to each color
        var that = this; //
        var shapes_list = containerElem.querySelectorAll('.shape-item'); //return NodeList
        var shapes_array = [...shapes_list]; // convert NodeList to Array

        shapes_array.forEach( function(shape) {
            shape.addEventListener('click', function() {
                that.shapeChangeEvent.shape = shape.getAttribute('data-shape');
                that.getPalette().dispatchEvent(that.shapeChangeEvent);
                that.popDown();
            });
        });
    }

    // Prototype inheritance from base Palette
    var addEventListener = function(type, listener, useCapture) {
        return this.getPalette().addEventListener(type, listener, useCapture);
    }

    shapepalette.ShapePalette.prototype = Object.create(palette.Palette.prototype, {
        addEventListener: {
            value: addEventListener,
            enumerable: true,
            configurable: true,
            writable: true
        }
    });

    return shapepalette;
});
