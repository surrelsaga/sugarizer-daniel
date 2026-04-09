requirejs.config({
    baseUrl: "lib",
    paths: {
        activity: "../js",
        drawmode: "../js/drawmode",
        numbermode: "../js/numbermode",
        gamemode: "../js/gamemode"
    }
});

requirejs(["activity/activity"]);
