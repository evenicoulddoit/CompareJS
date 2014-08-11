({
  baseUrl: "../src/js/lib",
  paths: {
    app: "../app"
  },
  shim: {
    "promise": {
      exports: "Promise"
    }
  },
  name: "almond",
  include: ["app/main"],
  insertRequire: ["app/main"],
  out: "../out/js/compare.js",
  optimize: "uglify2",
  findNestedDependencies: true,
  wrap: true,
  pragmas: {
    test: false
  }
})
