requirejs.config({
  baseUrl: "static/src/js/lib",
  paths: {
    app: "../app/"
  },
  shim: {
    "promise": {
      exports: "Promise"
    }
  }
});

requirejs(["app/main"]);
