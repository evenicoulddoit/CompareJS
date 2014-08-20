requirejs.config({
  baseUrl: "../src/js/lib",
  paths: {
    app: "../app/"
  },
  shim: {
    "promise": {
      exports: "Promise"
    }
  },
  pragmas: {
    test: true
  }
});
