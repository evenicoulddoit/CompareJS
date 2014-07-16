({
  baseUrl: "static/src/js/lib",
  paths: {
    app: "../app/"
  },
  shim: {
    "promise": {
      exports: "Promise"
    }
  },
  name: "almond",
  include: ["app/main"],
  insertRequire: ["app/main"],
  out: "built/compare.js",
  optimize: "uglify2",
  findNestedDependencies: true,
  wrap: true
})
