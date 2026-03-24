define(["sugar-web/graphics/palette","text!colorpalette.html"], function(palette, template) {

    var colorpalette = {};

    colorpalette.ColorPalette = function(invoker, primaryText) {
        // Call parent constructor - wires up popup toggle on button click
        palette.Palette.call(this, invoker, primaryText);

        // Load the HTML template into the palette
        var containerElem = document.createElement('div');
        containerElem.innerHTML = template;
        this.setContent([containerElem]);

        //Create a custom event to change color
        this.colorChangeEvent = document.createEvent('CustomEvent'); //similar to add a key-value pair to the Object
        //This initialize the event with a name (read about initCustomEvent)
        this.colorChangeEvent.initCustomEvent('colorChange', true, true, { color: '' });

        //Attach event listeners to each color
        var that = this; //
        var colors_list = containerElem.querySelectorAll('.color-item'); //return NodeList
        var colors_array = [...colors_list]; // convert NodeList to Array

        colors_array.forEach( function(color) {
            color.addEventListener('click', function() {
                that.colorChangeEvent.color = color.getAttribute('data-color');
                that.getPalette().dispatchEvent(that.colorChangeEvent);
                that.popDown();
            });
        });
    }

    // Prototype inheritance from base Palette
    var addEventListener = function(type, listener, useCapture) {
        return this.getPalette().addEventListener(type, listener, useCapture);
    }

    colorpalette.ColorPalette.prototype = Object.create(palette.Palette.prototype, {
        addEventListener: {
            value: addEventListener,
            enumerable: true,
            configurable: true,
            writable: true
        }
    });

    return colorpalette;
});
