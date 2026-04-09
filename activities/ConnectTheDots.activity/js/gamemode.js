define([], function () {

    // Number mode module
    // Receives a config object (shared resources from the controller)
    // Returns a stopNumberMode cleanup function

    return function startGameMode(config) {
        // Number mode implementation will go here
        return function stopGameMode() {};
    };
});
