var assert = require("chai").assert,
    console = require("console"),
    jsdom = require("jsdom").jsdom,
    requirejs = require(__base + ".config/require");

var document = jsdom(""),
    window = document.window;

describe("dom/visual", function() {
  var visual;

  before(function(done) {
    requirejs(["dom/visual"], function(m) {
      visual = m;
      done();
    });
  });

  describe("#startsWith()", function() {
    it("Responds correctly to string inputs", function() {
      var sw = visual._startsWith("foo");
      assert.equal(sw("fooey"), true);
      assert.equal(sw("oof"), false);
    });
  });

  describe("#removeKeys()", function() {
    it("Correctly remove a list of keys from an object in-place", function() {
      var initial = { a: "a", b: "b", c: "c", d: "d" },
          toRemove = ["a", "c"],
          expected = { b: "b", d: "d" };

      assert.deepEqual(expected, visual._removeKeys(initial, toRemove));
    });
  });

  describe("#notEmpty()", function() {
    it("Correctly identifies empty strings", function() {
      assert.isTrue(visual._notEmpty("stuff"));
      assert.isFalse(visual._notEmpty(""));
      assert.isFalse(visual._notEmpty(" "));
    });
  });

  describe("#uniformName()", function() {
    it("Correctly removes -value suffixes", function() {
      assert.equal("border-right", visual._uniformName("border-right"));
      assert.equal("some-value-foo", visual._uniformName("some-value-foo"));
      assert.equal("silly", visual._uniformName("silly-value"));
    });
  });

  describe("#equalValues()", function() {
    it("Correctly identifies when the specified values in an Array are equal", function() {
      assert.isTrue(visual._equalValues({
          a: 1,
          b: 1,
          c: 2
        }, ["a", "b"]));

      assert.isFalse(visual._equalValues({
          a: 1,
          b: 1,
          c: 2
        }, ["a", "b", "c"]));

      assert.isFalse(visual._equalValues({
          a: 1,
          b: 1,
          c: "1"
        }, ["a", "b", "c"]));
    });
  });

  describe("#elementMatches()", function() {
    it("Correctly identifies when an element matches a CSS selector", function() {
      var div = document.createElement("div");
      console.log(div.matches("div"));
      console.log(visual._elementMatches(div, "div"));
      assert.isTrue(visual._elementMatches(div, "div"));
    });
  });
});
