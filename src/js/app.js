requirejs.config({
  baseUrl: "js/lib",
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
