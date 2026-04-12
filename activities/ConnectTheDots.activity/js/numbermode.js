define([], function () {

    // Number mode module
    // Receives a config object (shared resources from the controller)
    // Returns a stopNumberMode cleanup function

    return function startNumberMode(config, changeShapePalette) {
        // Get resources from config
        var svgCanvas = config.svgCanvas;
        var gridContainer = config.gridContainer;
        var changeColorPalette = config.changeColorPalette;

        // 2 layers to draw shape and line
        var shapeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        var lineLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        svgCanvas.appendChild(shapeLayer);
        svgCanvas.appendChild(lineLayer);

        // State variables
        var choosenColor = null;
        var currentStep = 0; //current dot that user is at (first dot, second dot,etc..)
        var lastDotCoords = null;
        var connectedPoints = []; //later use all the coordinates of the connected point to form a shape
        var generatedWrappers = [];

        changeColorPalette.addEventListener('colorChange', function(event) {
            choosenColor = event.color;
        })

        // Hardcoded predefined shape templates (prototype only)
        // Each array is a dot's grid position to form a desired shape
        var templates = {
            triangle: [
                {row: 2, col: 5},
                {row: 6, col: 3},
                {row: 6, col: 7}
            ],
            square: [
                { row: 2, col: 3},
                { row: 2, col: 7},
                { row: 6, col: 7},
                { row: 6, col: 3}
            ],
            star: [
                {row: 2, col: 9},
                {row: 5, col: 10},
                {row: 5, col: 13},
                {row: 7, col: 11},
                {row: 9, col: 11},
                {row: 8, col: 9},
                {row: 9, col: 7},
                {row: 7, col: 7},
                {row: 5, col: 5},
                {row: 5, col: 8}
            ]
        };

        // Use triangle as the default template
        var currentTemplate = templates.triangle;

        function onShapeChange(event) {
            currentTemplate = templates[event.shape];

            // Clear current game state
            resetGame();

            // Remove old dot wrappers
            for (var i = 0; i < generatedWrappers.length; i++) {
                if (generatedWrappers[i].parentNode === gridContainer) {
                    gridContainer.removeChild(generatedWrappers[i]);
                }
            }
            generatedWrappers = [];

            // Rebuild grid with new template
            createDotGrid();
        }

        // Manipulate switch shape templates button
        changeShapePalette.addEventListener('shapeChange', onShapeChange);

        // Get coordinate of every dots
        function getCoordinates(element) {
            var dotRect = element.getBoundingClientRect();
            var svgRect = svgCanvas.getBoundingClientRect();
            return {
                x: (dotRect.left - svgRect.left) + dotRect.width / 2,
                y: (dotRect.top - svgRect.top) + dotRect.height / 2
            };
        }

        // Function to draw lines (in this number mode, for prototype -> only want color black)
        function createLine(x1, y1, x2, y2, color) {
            var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", x1);
            line.setAttribute("y1", y1);
            line.setAttribute("x2", x2);
            line.setAttribute("y2", y2);
            line.setAttribute("stroke", color);
            lineLayer.appendChild(line);

            return line;
        }

        // Create shapes from connecting points
        function createPolygon(points, color) {
            var polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            var polygonPoints = points.map(function (point) {
                return point.x + "," + point.y;
            }).join(" ");
            polygon.setAttribute("points", polygonPoints);
            polygon.style.fill = color;
            shapeLayer.appendChild(polygon);

            return polygon;
        }

        // Show a win message overlay when user completes the shape
        function showWinMessage() {
            var overlay = document.createElement("div");
            overlay.id = "win-overlay";
            overlay.innerHTML = '<div class="win-content">' +
                '<h1>You Win!</h1>' +
                '<p>You connected all the dots correctly!</p>' +
                '<button id="play-again-btn">Play Again</button>' +
                '</div>';
            document.body.appendChild(overlay);

            document.getElementById("play-again-btn").addEventListener("click", function () {
                resetGame();
                document.body.removeChild(overlay);
            });
        }

        // Reset the game to play again with the same shape template
        function resetGame() {
            // Remove all drawn lines and shapes
            while (lineLayer.firstChild) lineLayer.removeChild(lineLayer.firstChild);
            while (shapeLayer.firstChild) shapeLayer.removeChild(shapeLayer.firstChild);

            // Reset state back to initial
            currentStep = 0;
            lastDotCoords = null;
            connectedPoints = [];

            // Remove active class from all dots
            var activeDots = gridContainer.querySelectorAll(".dot.active");
            for (var i = 0; i < activeDots.length; i++) {
                activeDots[i].classList.remove("active");
            }
        }

        function createDotGrid() {
            var columns = Math.floor(window.innerWidth / 40);
            var rows = Math.floor(window.innerHeight / 40);
            var totalDots = columns * rows;

            // Build a dictionary: "row,col" string -> know highlighted dot index
            // e.g: A point is at (6,3) => through this dictionary, we know it's the #1 point 
            var templateLookup = {};
            for (var t = 0; t < currentTemplate.length; t++) {
                var key = currentTemplate[t].row + ',' + currentTemplate[t].col;
                templateLookup[key] = t;
            }

            for (var i = 0; i < totalDots; i++) {
                (function () {
                    // Math formulae to find position (row, col not coordinates) of each dot
                    var row = Math.floor(i / columns);
                    var col = i % columns;
                    var dotKey = row + ',' + col;

                    var wrapper = document.createElement("div");
                    wrapper.classList.add("dot-wrapper");

                    var dot = document.createElement("div");
                    dot.classList.add("dot");

                    // Check if this dot is part of the current shape template
                    // so we can add index number to those dot
                    var templateIndex = templateLookup[dotKey];

                    // If it is part of the template, add a numbered label and highlight class
                    if (templateIndex !== undefined) {
                        dot.classList.add("template-dot"); //styling class

                        var label = document.createElement('span');
                        label.classList.add("dot-number");

                        // Show the correct index number of the dot
                        // since we loop from 0
                        label.textContent = templateIndex + 1;
                        wrapper.appendChild(label);
                    }

                    function onDotClick() {
                        console.log("Clicked: row=" + row + ", col=" + col);
                        // Ignore clicks on non-template dots
                        if (templateIndex === undefined) return;

                        // Step 0: player must start connecting from dot #1 
                        // which has templateIndex 0
                        if (currentStep === 0) {
                            if (templateIndex !== 0) return;

                            lastDotCoords = getCoordinates(dot);
                            connectedPoints = [lastDotCoords];
                            currentStep = 1;
                            dot.classList.add("active");

                            return;
                        }
                        // Final step: click back to dot #1 again to close to shape
                        // and win the game
                        if (currentStep === currentTemplate.length && templateIndex === 0) {
                            var firstCoords = connectedPoints[0];
                            createLine(lastDotCoords.x, lastDotCoords.y, firstCoords.x, firstCoords.y, choosenColor);
                            createPolygon(connectedPoints, choosenColor);
                            showWinMessage();

                            return;
                        }

                        // Middle steps: must click the next dot in a correct sequence
                        if (templateIndex !== currentStep) return;
                        var currentCoords = getCoordinates(dot);
                        createLine(lastDotCoords.x, lastDotCoords.y, currentCoords.x, currentCoords.y, choosenColor);
                        connectedPoints.push(currentCoords);
                        lastDotCoords = currentCoords;
                        currentStep++;
                        dot.classList.add("active");
                    };

                    dot.addEventListener("click", onDotClick);

                    wrapper.appendChild(dot);
                    gridContainer.appendChild(wrapper);
                    generatedWrappers.push(wrapper);
                })();
            }
        }

        // Build the grid when mode starts
        createDotGrid();


        return function stopNumberMode() {
            // Remove all dot wrappers from the grid
            for (var i = 0; i < generatedWrappers.length; i++) {
                if (generatedWrappers[i].parentNode === gridContainer) {
                    gridContainer.removeChild(generatedWrappers[i]);
                }
            }

            // Remove SVG layers
            if (shapeLayer.parentNode === svgCanvas) svgCanvas.removeChild(shapeLayer);
            if (lineLayer.parentNode === svgCanvas) svgCanvas.removeChild(lineLayer);

            // Remove win overlay if still showing
            var overlay = document.getElementById("win-overlay");
            if (overlay && overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };
    };
});
