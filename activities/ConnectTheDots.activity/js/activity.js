define(["sugar-web/activity/activity", "colorpalette"], function (activity, colorpalette) {

    requirejs(["domReady!"], function () {
        activity.setup();

        var gridContainer = document.getElementById("grid-container");
        var svgCanvas = document.getElementById("line-canvas");

        var drawModeBtn = document.getElementById("drawMode-button");
        var numberModeBtn = document.getElementById("numberMode-button");
        var undoBtn = document.getElementById("undo-button");
        var redoBtn = document.getElementById("redo-button");
        var clearBtn = document.getElementById("clear-button");
        var changeColorBtn = document.getElementById("changeColor-button");

        var changeColorPalette = new colorpalette.ColorPalette(
            changeColorBtn,
            "Change Color"
        );

        var currentMode = null;
        var cleanupCurrentMode = null;

        function switchMode(nextMode) {
            if (cleanupCurrentMode) {
                cleanupCurrentMode();
                cleanupCurrentMode = null;
            }

            if (nextMode === "draw") {
                cleanupCurrentMode = startDrawMode();
            } else if (nextMode === "number") {
                cleanupCurrentMode = startNumberMode();
            }

            currentMode = nextMode;
            updateToolbarState();
        }

        function updateToolbarState() {
            drawModeBtn.classList.toggle("active", currentMode === "draw");
            numberModeBtn.classList.toggle("active", currentMode === "number");
        }

        function startDrawMode() {
            var shapeLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
            var lineLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
            svgCanvas.appendChild(shapeLayer);
            svgCanvas.appendChild(lineLayer);

            var currentColor = "rgba(0, 200, 0, 0.4)";
            var isDrawing = false;
            var lastDotCoords = null;
            var currentShapePoints = [];
            var undoStack = [];
            var redoStack = [];
            var currentStrokeLines = [];
            var generatedWrappers = [];

            function onColorChange(event) {
                currentColor = event.color;
            }

            function calculateArea(points) {
                var area = 0;
                var n = points.length;
                for (var i = 0; i < n; i++) {
                    var j = (i + 1) % n;
                    area += points[i].x * points[j].y;
                    area -= points[j].x * points[i].y;
                }
                return Math.abs(area / 2);
            }

            function sortShapeLayer() {
                var polygons = Array.prototype.slice.call(shapeLayer.querySelectorAll("polygon"));
                polygons.sort(function (a, b) {
                    return b._area - a._area;
                });

                for (var i = 0; i < polygons.length; i++) {
                    shapeLayer.appendChild(polygons[i]);
                }
            }

            function getCoordinates(element) {
                var dotRect = element.getBoundingClientRect();
                var svgRect = svgCanvas.getBoundingClientRect();

                return {
                    x: (dotRect.left - svgRect.left) + dotRect.width / 2,
                    y: (dotRect.top - svgRect.top) + dotRect.height / 2
                };
            }

            function drawLine(startCoords, endCoords) {
                var line = document.createElementNS("http://www.w3.org/2000/svg", "line");
                line.setAttribute("x1", startCoords.x);
                line.setAttribute("y1", startCoords.y);
                line.setAttribute("x2", endCoords.x);
                line.setAttribute("y2", endCoords.y);
                line.setAttribute("stroke", currentColor);

                lineLayer.appendChild(line);
                currentStrokeLines.push(line);
            }

            function clearActiveDots() {
                document.querySelectorAll(".dot.active").forEach(function (activeDot) {
                    activeDot.classList.remove("active");
                });
            }

            function onUndo() {
                if (undoStack.length === 0) {
                    return;
                }

                isDrawing = false;
                lastDotCoords = null;

                var action = undoStack.pop();

                if (action.type === "polygonGroup") {
                    if (action.polygon.parentNode === shapeLayer) {
                        shapeLayer.removeChild(action.polygon);
                    }
                    for (var i = 0; i < action.lines.length; i++) {
                        if (action.lines[i].parentNode === lineLayer) {
                            lineLayer.removeChild(action.lines[i]);
                        }
                    }
                } else {
                    if (action.parentNode === lineLayer) {
                        lineLayer.removeChild(action);
                    }
                }

                redoStack.push(action);
            }

            function onRedo() {
                if (redoStack.length === 0) {
                    return;
                }

                isDrawing = false;
                lastDotCoords = null;

                var action = redoStack.pop();

                if (action.type === "polygonGroup") {
                    for (var i = 0; i < action.lines.length; i++) {
                        lineLayer.appendChild(action.lines[i]);
                    }
                    shapeLayer.appendChild(action.polygon);
                    sortShapeLayer();
                } else {
                    lineLayer.appendChild(action);
                }

                undoStack.push(action);
            }

            function onClear() {
                while (shapeLayer.firstChild) {
                    shapeLayer.removeChild(shapeLayer.firstChild);
                }

                while (lineLayer.firstChild) {
                    lineLayer.removeChild(lineLayer.firstChild);
                }

                isDrawing = false;
                lastDotCoords = null;
                currentShapePoints = [];
                currentStrokeLines = [];
                undoStack = [];
                redoStack = [];
                clearActiveDots();
            }

            function createDotGrid() {
                var columns = Math.floor(window.innerWidth / 40);
                var rows = Math.floor(window.innerHeight / 40);
                var totalDots = columns * rows;

                for (var i = 0; i < totalDots; i++) {
                    (function () {
                        var wrapper = document.createElement("div");
                        wrapper.classList.add("dot-wrapper");

                        var dot = document.createElement("div");
                        dot.classList.add("dot");

                        function onDotClick() {
                            isDrawing = !isDrawing;

                            if (isDrawing) {
                                currentStrokeLines = [];
                                lastDotCoords = getCoordinates(dot);
                                currentShapePoints = [lastDotCoords];
                                dot.classList.add("active");
                                return;
                            }

                            var stopDot = getCoordinates(dot);
                            var formedPolygon = false;

                            if (currentShapePoints.length > 3) {
                                var startingDot = currentShapePoints[0];

                                if (startingDot.x === stopDot.x && startingDot.y === stopDot.y) {
                                    var polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                                    var polygonPoints = currentShapePoints.map(function (point) {
                                        return point.x + "," + point.y;
                                    }).join(" ");

                                    polygon.setAttribute("points", polygonPoints);
                                    polygon.style.fill = currentColor;
                                    polygon._area = calculateArea(currentShapePoints);

                                    shapeLayer.appendChild(polygon);
                                    sortShapeLayer();

                                    undoStack.push({
                                        type: "polygonGroup",
                                        lines: currentStrokeLines.slice(),
                                        polygon: polygon
                                    });
                                    redoStack = [];
                                    formedPolygon = true;
                                }
                            }

                            if (!formedPolygon) {
                                for (var j = 0; j < currentStrokeLines.length; j++) {
                                    undoStack.push(currentStrokeLines[j]);
                                }
                                redoStack = [];
                            }

                            lastDotCoords = null;
                            currentShapePoints = [];
                            currentStrokeLines = [];
                            clearActiveDots();
                        }

                        function onDotEnter() {
                            if (!isDrawing) {
                                return;
                            }

                            var currentDotCoords = getCoordinates(dot);
                            drawLine(lastDotCoords, currentDotCoords);
                            currentShapePoints.push(currentDotCoords);
                            lastDotCoords = currentDotCoords;
                            dot.classList.add("active");
                        }

                        dot.addEventListener("click", onDotClick);
                        dot.addEventListener("mouseenter", onDotEnter);

                        wrapper.appendChild(dot);
                        gridContainer.appendChild(wrapper);
                        generatedWrappers.push(wrapper);
                    })();
                }
            }

            changeColorPalette.addEventListener("colorChange", onColorChange);
            undoBtn.addEventListener("click", onUndo);
            redoBtn.addEventListener("click", onRedo);
            clearBtn.addEventListener("click", onClear);

            createDotGrid();

            return function stopDrawMode() {
                changeColorPalette.getPalette().removeEventListener("colorChange", onColorChange);
                undoBtn.removeEventListener("click", onUndo);
                redoBtn.removeEventListener("click", onRedo);
                clearBtn.removeEventListener("click", onClear);

                clearActiveDots();

                for (var i = 0; i < generatedWrappers.length; i++) {
                    if (generatedWrappers[i].parentNode === gridContainer) {
                        gridContainer.removeChild(generatedWrappers[i]);
                    }
                }

                if (shapeLayer.parentNode === svgCanvas) {
                    svgCanvas.removeChild(shapeLayer);
                }
                if (lineLayer.parentNode === svgCanvas) {
                    svgCanvas.removeChild(lineLayer);
                }
            };
        }

        function startNumberMode() {
            function stopNumberMode() {
            }

            return stopNumberMode;
        }

        drawModeBtn.addEventListener("click", function () {
            switchMode("draw");
        });

        numberModeBtn.addEventListener("click", function () {
            switchMode("number");
        });

        updateToolbarState();
    });
});
