requirejs.config({
    baseUrl: "lib",
    paths: {
        activity: "../js",
        drawmode: "../js/drawmode",
        numbermode: "../js/numbermode"
    }
});

requirejs(["activity/activity"]);
