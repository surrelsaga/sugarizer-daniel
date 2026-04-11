define([], function () {

    // Game mode module
    // Receives a config object (shared resources from the controller)
    // Returns a stopNumberMode cleanup function

    return function startGameMode(config) {
        var svgCanvas = config.svgCanvas;
        var gridContainer = config.gridContainer;

        var columns = Math.floor(window.innerHeight / 40);
        var rows = Math.floor(window.innerWidth / 40);
        var totalDots = columns * rows;

        for(var i = 0; i < totalDots; i++){
            var wrapper = document.createElement('div');
            wrapper.classList.add('dot-wrapper');

            var dot = document.createElement('div');
            dot.classList.add('dot');


            wrapper.appendChild(dot);
            gridContainer.appendChild(wrapper);
        }
        return function stopGameMode() {};
    };
});
