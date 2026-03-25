define(["sugar-web/activity/activity", "sugar-web/env", "sugar-web/graphics/presencepalette", "colorpalette"], function (activity, env, presencepalette, colorpalette) {

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

        // Link presence palette
        var networkPalette = new presencepalette.PresencePalette(
            document.getElementById('network-button'),
            undefined
        );

        // Presence states
        var presence = null;
        var isHost = false;

        var currentMode = null;
        var cleanupCurrentMode = null;

        // Serializable history for saving to datastore
        var drawHistory = [];

        // PRESENCE: Teach the server how to handle messages delivered
        // 'init' means the msg is triggered by the host  => show current board state for everyone again (including newly-joined people)
        // 'update' means the msg is triggered by the participants => update the current board state, and redraw so everyone can see
        var onNetworkDataReceived = function(msg) {
            // Test networkId in the message to ignore the message that we sent ourselves
            if (presence.getUserInfo().networkId === msg.user.networkId) {
                return;
            }

            switch (msg.content.action) {
                case "init":
                    // Sync from host, rebuild entire drawing
                    drawHistory = [];
                    if (cleanupCurrentMode) {
                        cleanupCurrentMode();
                        cleanupCurrentMode = null;
                    }
                    cleanupCurrentMode = startDrawMode(msg.content.data);
                    currentMode = "draw";
                    updateToolbarState();
                    break;
                
                case "update":
                    // Single new drawing action from another user
                    // Use loadFromData to add just this one entry
                    if (currentMode === "draw" && currentLoadFromData) {
                        currentLoadFromData([msg.content.data]);
                    }
                    break;
            }
        };

        // onSharedActivityUserChanged: method to know when a person enters/leaves the room
        var onNetworkUserChanged = function(msg) {
            if (isHost) {
                // Send full drawing to the new joiner
                presence.sendMessage(presence.getSharedInfo().id, {
                    user: presence.getUserInfo(),
                    content: {
                        action: 'init',
                        data: drawHistory
                    }
                });
            }
        };

        // PRESENCE: Share button clicked
        networkPalette.addEventListener('shared', function() {
            networkPalette.popDown(); // Close the palette first
            console.log("Want to share")

            presence = activity.getPresenceObject( function(error, network) {
                if (error) { //If not connected to a server
                    console.log("Sharing error: " + error);
                    return;
                }
                // If user is successfully connected to the server, a presence object will be retrieved
                // Display the shared activity in the neighborhood view so everyone can see
                network.createSharedActivity('org.sugarlabs.ConnectTheDots', function(groupId) {
                    console.log("Activity shared, group: " + groupId);

                    // When we open publicly the activity, createShareActivity is triggered
                    // That means this room is public and has a host now
                    isHost = true; 
                });

                network.onDataReceived(onNetworkDataReceived);
                network.onSharedActivityUserChanged(onNetworkUserChanged);
            });
        });

        // Function to send drawing updates to the network
        function sendNetworkUpdate(entry) {
            if (presence) {
                presence.sendMessage(presence.getSharedInfo().id, {
                    user: presence.getUserInfo(),
                    content: {
                        action: 'update',
                        data: entry
                    }
                });
            }
        }

        // Broadcast full state (used by undo/redo/clear)
        function sendFullState() {
            if (presence) {
                presence.sendMessage(presence.getSharedInfo().id, {
                    user: presence.getUserInfo(),
                    content: {
                        action: 'init',
                        data: drawHistory
                    }
                });
            }
        }

        function switchMode(nextMode) {
            if (cleanupCurrentMode) {
                cleanupCurrentMode();
                cleanupCurrentMode = null;
            }

            if (nextMode === "draw") {
                cleanupCurrentMode = startDrawMode(drawHistory);
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

        // Expose loadFromData so presence can call it from outside
        var currentLoadFromData = null;

        function startDrawMode(savedData) {
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

            // Create an SVG line from coordinate data and add to lineLayer
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

            // Create an SVG polygon from points data and add to shapeLayer
            function createPolygon(points, color) {
                var polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
                var polygonPoints = points.map(function (point) {
                    return point.x + "," + point.y;
                }).join(" ");
                polygon.setAttribute("points", polygonPoints);
                polygon.style.fill = color;
                polygon._area = calculateArea(points);
                shapeLayer.appendChild(polygon);
                return polygon;
            }

            function drawLine(startCoords, endCoords) {
                var line = createLine(startCoords.x, startCoords.y, endCoords.x, endCoords.y, currentColor);
                currentStrokeLines.push(line);
            }

            function clearActiveDots() {
                document.querySelectorAll(".dot.active").forEach(function (activeDot) {
                    activeDot.classList.remove("active");
                });
            }

            function onUndo() {
                if (undoStack.length === 0) return;
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

                // Remove last entry from serializable history
                drawHistory.pop();
                redoStack.push(action);
                sendFullState(); //work in multiplayer
            }

            function onRedo() {
                if (redoStack.length === 0) return;
                isDrawing = false;
                lastDotCoords = null;

                var action = redoStack.pop();

                if (action.type === "polygonGroup") {
                    for (var i = 0; i < action.lines.length; i++) {
                        lineLayer.appendChild(action.lines[i]);
                    }
                    shapeLayer.appendChild(action.polygon);
                    sortShapeLayer();

                    // Re-add to serializable history
                    var lineDataArr = [];
                    for (var k = 0; k < action.lines.length; k++) {
                        var l = action.lines[k];
                        lineDataArr.push({
                            x1: parseFloat(l.getAttribute("x1")),
                            y1: parseFloat(l.getAttribute("y1")),
                            x2: parseFloat(l.getAttribute("x2")),
                            y2: parseFloat(l.getAttribute("y2")),
                            color: l.getAttribute("stroke")
                        });
                    }
                    drawHistory.push({
                        type: "polygonGroup",
                        lines: lineDataArr,
                        points: action._savedPoints,
                        color: action.polygon.style.fill
                    });
                } else {
                    lineLayer.appendChild(action);

                    // Re-add to serializable history
                    drawHistory.push({
                        type: "line",
                        x1: parseFloat(action.getAttribute("x1")),
                        y1: parseFloat(action.getAttribute("y1")),
                        x2: parseFloat(action.getAttribute("x2")),
                        y2: parseFloat(action.getAttribute("y2")),
                        color: action.getAttribute("stroke")
                    });
                }

                undoStack.push(action);
                sendFullState(); //work in multiplayer
            }

            function onClear() {
                while (shapeLayer.firstChild) shapeLayer.removeChild(shapeLayer.firstChild);
                while (lineLayer.firstChild) lineLayer.removeChild(lineLayer.firstChild);

                isDrawing = false;
                lastDotCoords = null;
                currentShapePoints = [];
                currentStrokeLines = [];
                undoStack = [];
                redoStack = [];
                drawHistory = [];
                clearActiveDots();
                sendFullState(); //work in multiplayer
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
                                    var polygon = createPolygon(currentShapePoints, currentColor);
                                    sortShapeLayer();

                                    // Save line data for serialization
                                    var lineDataArr = [];
                                    for (var k = 0; k < currentStrokeLines.length; k++) {
                                        var l = currentStrokeLines[k];
                                        lineDataArr.push({
                                            x1: parseFloat(l.getAttribute("x1")),
                                            y1: parseFloat(l.getAttribute("y1")),
                                            x2: parseFloat(l.getAttribute("x2")),
                                            y2: parseFloat(l.getAttribute("y2")),
                                            color: l.getAttribute("stroke")
                                        });
                                    }

                                    var actionObj = {
                                        type: "polygonGroup",
                                        lines: currentStrokeLines.slice(),
                                        polygon: polygon,
                                        _savedPoints: currentShapePoints.slice()
                                    };
                                    undoStack.push(actionObj);
                                    redoStack = [];

                                    var historyEntry = {
                                        type: "polygonGroup",
                                        lines: lineDataArr,
                                        points: currentShapePoints.slice(),
                                        color: currentColor
                                    };
                                    drawHistory.push(historyEntry);

                                    // Send to network
                                    sendNetworkUpdate(historyEntry);

                                    formedPolygon = true;
                                }
                            }

                            if (!formedPolygon) {
                                for (var j = 0; j < currentStrokeLines.length; j++) {
                                    undoStack.push(currentStrokeLines[j]);

                                    // Push each line as serializable data
                                    var ln = currentStrokeLines[j];
                                    var historyEntry = {
                                        type: "line",
                                        x1: parseFloat(ln.getAttribute("x1")),
                                        y1: parseFloat(ln.getAttribute("y1")),
                                        x2: parseFloat(ln.getAttribute("x2")),
                                        y2: parseFloat(ln.getAttribute("y2")),
                                        color: ln.getAttribute("stroke")
                                    };
                                    drawHistory.push(historyEntry);

                                    // Send each line to network
                                    sendNetworkUpdate(historyEntry);
                                }
                                redoStack = [];
                            }

                            lastDotCoords = null;
                            currentShapePoints = [];
                            currentStrokeLines = [];
                            clearActiveDots();
                        }

                        function onDotEnter() {
                            if (!isDrawing) return;
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

            // Rebuild drawing from saved data (when resuming from journal)
            function loadFromData(data) {
                for (var i = 0; i < data.length; i++) {
                    var entry = data[i];

                    if (entry.type === "line") {
                        var line = createLine(entry.x1, entry.y1, entry.x2, entry.y2, entry.color);
                        undoStack.push(line);
                    } else if (entry.type === "polygonGroup") {
                        var lines = [];
                        for (var j = 0; j < entry.lines.length; j++) {
                            var ld = entry.lines[j];
                            lines.push(createLine(ld.x1, ld.y1, ld.x2, ld.y2, ld.color));
                        }
                        var polygon = createPolygon(entry.points, entry.color);
                        undoStack.push({
                            type: "polygonGroup",
                            lines: lines,
                            polygon: polygon,
                            _savedPoints: entry.points.slice()
                        });
                    }

                    // Also track in drawHistory if not already there
                    drawHistory.push(entry);
                }
                sortShapeLayer();
            }

            // Expose loadFromData so the presence handler can call it
            currentLoadFromData = loadFromData;

            changeColorPalette.addEventListener("colorChange", onColorChange);
            undoBtn.addEventListener("click", onUndo);
            redoBtn.addEventListener("click", onRedo);
            clearBtn.addEventListener("click", onClear);

            createDotGrid();

            // If saved data was passed in, rebuild the drawing
            if (savedData && savedData.length > 0) {
                loadFromData(savedData);
            }

            return function stopDrawMode() {
                // Switch mode then not loading the draw mode UI anymore
                currentLoadFromData = null;

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

                if (shapeLayer.parentNode === svgCanvas) svgCanvas.removeChild(shapeLayer);
                if (lineLayer.parentNode === svgCanvas) svgCanvas.removeChild(lineLayer);
            };
        }

        function startNumberMode() {
            return function stopNumberMode() {};
        }

        //  DATASTORE: Save on stop button
        document.getElementById("stop-button").addEventListener("click", function () {
            var jsonData = JSON.stringify(drawHistory);
            activity.getDatastoreObject().setDataAsText(jsonData);
            activity.getDatastoreObject().save(function (error) {
                if (error === null) {
                    console.log("write done.");
                } else {
                    console.log("write failed.");
                }
            });
        });

        //  DATASTORE + PRESENCE : Load on start
        env.getEnvironment(function (err, environment) {
            if (environment.sharedId) {
                // Joining a shared activity
                console.log("Shared instance");
                presence = activity.getPresenceObject( function(error, network) {
                    network.onDataReceived(onNetworkDataReceived);
                    network.onSharedActivityUserChanged(onNetworkUserChanged);
                });

                // Start draw mode
                switchMode("draw");
            } else if (!environment.objectId) {
                // New instance — start draw mode with empty canvas
                console.log("New instance");
                switchMode("draw"); //This is why the starting UI of the activity is draw mode UI
            } else {
                // Existing instance — load saved data then start draw mode
                activity.getDatastoreObject().loadAsText(function (error, metadata, data) {
                    if (error === null && data !== null) {
                        var savedData = JSON.parse(data);
                        cleanupCurrentMode = startDrawMode(savedData);
                        currentMode = "draw";
                        updateToolbarState();
                    } else {
                        switchMode("draw");
                    }
                });
            }
        });

        drawModeBtn.addEventListener("click", function () {
            switchMode("draw");
        });

        numberModeBtn.addEventListener("click", function () {
            switchMode("number");
        });
    });
});
