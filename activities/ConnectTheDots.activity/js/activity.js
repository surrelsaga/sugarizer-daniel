define(["sugar-web/activity/activity", "sugar-web/env", "sugar-web/graphics/presencepalette", "colorpalette", "shapepalette", "drawmode", "numbermode","gamemode"],
function (activity, env, presencepalette, colorpalette, shapepalette, drawmode, numbermode, gamemode) {

    requirejs(["domReady!"], function () {
        activity.setup();

        var gridContainer = document.getElementById("grid-container");
        var svgCanvas = document.getElementById("line-canvas");

        var drawModeBtn = document.getElementById("drawMode-button");
        var numberModeBtn = document.getElementById("numberMode-button");
        var gameModeBtn = document.getElementById("gameMode-button");
        var undoBtn = document.getElementById("undo-button");
        var redoBtn = document.getElementById("redo-button");
        var clearBtn = document.getElementById("clear-button");
        var changeColorBtn = document.getElementById("changeColor-button");
        var changeShapeBtn = document.getElementById("changeShape-button");

        // Special palettes
        var changeColorPalette = new colorpalette.ColorPalette(
            changeColorBtn,
            "Change Color"
        );

        var changeShapePalette = new shapepalette.ShapePalette(
            changeShapeBtn,
            "Change Shape"
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

        // Expose loadFromData so presence can call it from outside
        var currentLoadFromData = null;

        // ===== CONFIG OBJECT =====
        // Single object passed to every mode — contains shared DOM, data, and network helpers
        // Modes never import Sugar modules directly; they only know about this config
        var config = {
            svgCanvas: svgCanvas,
            gridContainer: gridContainer,
            undoBtn: undoBtn,
            redoBtn: redoBtn,
            clearBtn: clearBtn,
            changeColorPalette: changeColorPalette,
            drawHistory: drawHistory,
            // Function to send drawing updates to the network
            sendNetworkUpdate: function (entry) {
                if (presence) {
                    presence.sendMessage(presence.getSharedInfo().id, {
                        user: presence.getUserInfo(),
                        content: { action: 'update', data: entry }
                    });
                }
            },
            // Broadcast full state (used by undo/redo/clear)
            sendFullState: function () {
                if (presence) {
                    presence.sendMessage(presence.getSharedInfo().id, {
                        user: presence.getUserInfo(),
                        content: { action: 'init', data: drawHistory }
                    });
                }
            },
            // Bridge: mode exposes its loadFromData back to the controller
            setLoadFromData: function (fn) {
                currentLoadFromData = fn;
            }
        };

        // PRESENCE: Teach the server how to handle messages delivered
        // 'init' means the msg is triggered by the host  => show current board state for everyone again (including newly-joined people)
        // 'update' means the msg is triggered by the participants => update the current board state, and redraw so everyone can see
        var onNetworkDataReceived = function (msg) {
            // Test networkId in the message to ignore the message that we sent ourselves
            if (presence.getUserInfo().networkId === msg.user.networkId) {
                return;
            }

            switch (msg.content.action) {
                case "init":
                    // Sync from host, rebuild entire drawing
                    drawHistory.length = 0;
                    if (cleanupCurrentMode) {
                        cleanupCurrentMode();
                        cleanupCurrentMode = null;
                    }
                    cleanupCurrentMode = drawmode(config, msg.content.data);
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
        var onNetworkUserChanged = function (msg) {
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
        networkPalette.addEventListener('shared', function () {
            networkPalette.popDown(); // Close the palette first
            console.log("Want to share");

            presence = activity.getPresenceObject(function (error, network) {
                if (error) { //If not connected to a server
                    console.log("Sharing error: " + error);
                    return;
                }
                // If user is successfully connected to the server, a presence object will be retrieved
                // Display the shared activity in the neighborhood view so everyone can see
                network.createSharedActivity('org.sugarlabs.ConnectTheDots', function (groupId) {
                    console.log("Activity shared, group: " + groupId);

                    // When we open publicly the activity, createShareActivity is triggered
                    // That means this room is public and has a host now
                    isHost = true;
                });

                network.onDataReceived(onNetworkDataReceived);
                network.onSharedActivityUserChanged(onNetworkUserChanged);
            });
        });

        //  MODE CONTROLLER
        function switchMode(nextMode) {
            if (cleanupCurrentMode) {
                cleanupCurrentMode();
                cleanupCurrentMode = null;
            }

            if (nextMode === "draw") {
                // Pass a copy so loadFromData doesn't push into the same array it's iterating
                var savedCopy = drawHistory.slice();
                drawHistory.length = 0;
                cleanupCurrentMode = drawmode(config, savedCopy);
            } else if (nextMode === "number") {
                // changeShapePalette should only be activated during number mode
                cleanupCurrentMode = numbermode(config, changeShapePalette);
            } else if (nextMode === "game") {
                cleanupCurrentMode = gamemode(config);
            }

            currentMode = nextMode;
            updateToolbarState();
        }

        function updateToolbarState() {
            drawModeBtn.classList.toggle("active", currentMode === "draw");
            numberModeBtn.classList.toggle("active", currentMode === "number");
            gameModeBtn.classList.toggle("active", currentMode === "game");
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
                presence = activity.getPresenceObject(function (error, network) {
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
                        cleanupCurrentMode = drawmode(config, savedData);
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

        gameModeBtn.addEventListener('click', function() {
            switchMode("game");
        })
    });
});
