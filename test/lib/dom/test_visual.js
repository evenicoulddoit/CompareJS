(function() { "use strict";
  QUnit.stop();

  /**
   * Mock a CSSStyleDeclaration
   * @param {Object} styles - an object of key-value CSS rule pairs
   */
  function MockCSSStyleDeclaration(styles) {
    var i = 0, style;
    this.styles = styles;
    this.length = Object.keys(this.styles).length;

    for(style in styles) {
      if(styles.hasOwnProperty(style)) {
        this[i] = style;
        i++;
      }
    }
  }

  MockCSSStyleDeclaration.prototype.getPropertyValue = function(prop) {
    return this.styles[prop];
  };

  QUnit.module("dom/visual", {
    setup: function() {

      // Note: unfortunately PhantomJS doesn't have a default stylesheet,
      // and so the length of a CSSStyleDeclaration will depend on the rules
      // set explicitly here. For all tested browsers this was _not_ the case,
      // where the number of rules was _always_ the same for all elements.
      // 
      // Note: Hex colours are converted to RGB by the browser.
      $("body").append(
        "<div id=\"test-container\"> " +
          "<div id=\"foo-wrapper\"> " +
            "<div id=\"foo\">zulu</div> " +
          "</div> " +
          "<div id=\"bar-wrapper\"> " +
            "<div id=\"bar\">zulu</div> " +
          "</div> " +
          "<style> " +
            "div { " +
              "display: block; " +
              "font-weight: 400; " +
              "color: #000; " +
            "}" +
            ".color { color: #111; } " +
            ".font-weight { font-weight: 700; } " +
            ".background-color { background-color: #eee; } " +
            ".display { display: inline-block; } " +
            ".width { width: 500px; } " +
            "div.position { position: absolute; } " +
         "</style> " +
        "</div>"
      );
    },

    teardown: function() {
      $("#test-container").remove();
    }
  });

  require(["config"], function() {
    require(["dom/visual"], function(visual) {


      /**
       * Private method tests.
       */

      QUnit.test("_startsWith() " +
        "Identifies all when one string starts with another", function(assert) {
        var sw = visual._startsWith("foo");
        assert.equal(sw("fooey"), true, "fooey begins with foo");
        assert.equal(sw("oof"), false, "oof doesn't begin with foo");
      });


      QUnit.test("_removeKeys() " +
        "Removes a list of keys from an object in-place", function(assert) {
        var initial = { a: "a", b: "b", c: "c", d: "d" },
            toRemove = ["a", "c"],
            expected = { b: "b", d: "d" };

        assert.deepEqual(visual._removeKeys(initial, toRemove), expected,
                         "The correct keys are removed from the object");
      });


      QUnit.test("_shorthandMarginPadding() " +
        "Combines margin and padding rules of the same value", function(assert) {

        // All identical margin rules, combine into one.
        // Leave the other rules as they are
        var identical = {
          "margin-top": "5px",
          "margin-right": "5px",
          "margin-bottom": "5px",
          "margin-left": "5px",
          "a-rule": "to-ignore"
        };

        assert.deepEqual(visual._shorthandMarginPadding(identical), {
            "margin": "5px",
            "a-rule": "to-ignore"
          },
          "All equal margin values are combined into 1 value."
        );

        var two_value = {
          "padding-top": "5px",
          "padding-right": "10px",
          "padding-bottom": "5px",
          "padding-left": "10px"
        };

        assert.deepEqual(visual._shorthandMarginPadding(two_value), {
            "padding": "5px 10px",
          },
          "Equal horizontal and vertical padding values are combined into 2 values."
        );

        var three_value = {
          "margin-top": "5px",
          "margin-right": "10px",
          "margin-bottom": "15px",
          "margin-left": "10px"
        };

        assert.deepEqual(visual._shorthandMarginPadding(three_value), {
            "margin": "5px 10px 15px",
          },
          "Equal left and right margin values are combined into 3 values."
        );

        var four_value = {
          "padding-top": "5px",
          "padding-right": "10px",
          "padding-bottom": "15px",
          "padding-left": "20px"
        };

        assert.deepEqual(visual._shorthandMarginPadding(four_value), {
            "padding": "5px 10px 15px 20px",
          },
          "All different padding values are combined into 4 values."
        );

        var missing_one = {
          "margin-top": "5px",
          "margin-right": "10px",
          "margin-bottom": "15px",
        };

        assert.deepEqual(visual._shorthandMarginPadding(missing_one), missing_one,
          "When one margin value is missing, don't combine."
        );
      });


      QUnit.test("_styleComputedDifferences() " +
        "Finds the different computed styles between two elements", function(assert) {
        var $a = $("#foo"),
            $aWrapper = $("#foo-wrapper"),
            $b = $("#bar"),
            a = $a.get(0),
            b = $b.get(0),
            differences;

        differences = visual._styleComputedDifferences(a, b);
        assert.deepEqual(differences, []);

        // We only check that both items are different because other styles may
        // change as a side effect. E.G. border colors may also change due to a
        // color change. This depends on the user agent.
        $a.addClass("color");
        differences = visual._styleComputedDifferences(a, b);
        assert.ok(differences.indexOf("color") != -1,
          "Changing the font color is recognised."
        );

        $b.addClass("font-weight");
        differences = visual._styleComputedDifferences(a, b);
        assert.ok(["color", "font-weight"].every(function(rule) {
            return differences.indexOf(rule) != -1;
          }),
          "Changing the font weight is recognised, along with the color"
        );

        $a.add($b).removeClass();
        $aWrapper.addClass("width");

        differences = visual._styleComputedDifferences(a, b);
        assert.ok(differences.indexOf("width") != -1,
          "Changing the width of a parent is still picked up as a computed difference."
        );
      });


      QUnit.test("_styleRuleDifference() " +
        "Identifies different stylesheet rules between two elements", function(assert) {
        var $a = $("#foo"),
            $b = $("#bar"),
            a = $a.get(0),
            b = $b.get(0),
            differences;

        differences = visual._styleRuleDifferences(a, b);
        assert.deepEqual(differences, {});

        $a.addClass("color");
        differences = visual._styleRuleDifferences(a, b);
        assert.deepEqual(differences, {
            "color": ["rgb(17, 17, 17)", "rgb(0, 0, 0)"]
          },
          "Adding a class to A which changes its color is recognised"
        );

        $b.addClass("display");
        differences = visual._styleRuleDifferences(a, b);
        assert.deepEqual(differences, {
            "color": ["rgb(17, 17, 17)", "rgb(0, 0, 0)"],
            "display": ["block", "inline-block"]
          },
          "Adding a class to B which changes its display is recognised"
        );

        $a.attr("class", "background-color");
        $b.removeClass();
        differences = visual._styleRuleDifferences(a, b);
        assert.deepEqual(differences, {
            "background-color": ["rgb(238, 238, 238)", undefined]
          },
          "Adding a rule to A which B doesn't have returns undefined for B"
        );
      });


      QUnit.test("_findRulesFor() " +
        "Finds the rules / specificity for a given element", function(assert) {
        var $a = $("#foo"),
            a = $a.get(0);

        assert.deepEqual(visual._findRulesFor(a), {
            "display": { "specificity": 1, "value": "block" },
            "font-weight": { "specificity": 1, "value": "400" },
            "color": { "specificity": 1, "value": "rgb(0, 0, 0)" }
          },
          "Checking against the element #foo retrieves all the .div styles"
        );

        $a.addClass("position");
        assert.deepEqual(visual._findRulesFor(a), {
            "display": { "specificity": 1, "value": "block" },
            "font-weight": { "specificity": 1, "value": "400" },
            "color": { "specificity": 1, "value": "rgb(0, 0, 0)" },
            "position": { "specificity": 11, "value": "absolute" }
          },
          "Adding a class which matches a more specific rule gets picked up"
        );
      });


      QUnit.test("_notEmpty() "+
        "Identifies empty strings", function(assert) {
        assert.strictEqual(visual._notEmpty("stuff"), true,
          "A non-empty string is recognised"
        );

        assert.strictEqual(visual._notEmpty(""), false,
          "A completely empty string is recognised"
        );

        assert.strictEqual(visual._notEmpty(" "), false,
          "A string with just spaces is recognised as empty"
        );
      });


      QUnit.test("_elementMatches() " +
        "Identifies when an element matches a CSS selector", function(assert) {
        var div = $("#foo").get(0);
        assert.strictEqual(visual._elementMatches(div, "div"), true,
          "A div element matches the string 'div'"
        );

        assert.strictEqual(visual._elementMatches(div, "#foo"), true,
          "A div without the class 'foo' doesn't match '#foo'"
        );

        assert.strictEqual(visual._elementMatches(div, "span"), false,
          "A div doesn't match the string 'span'"
        );
      });


      QUnit.test("_specificityAdd() " +
        "Replaces existing style if specificity is at least as much", function(assert) {

        var existing = {};

        visual._specificityAdd(1, existing, new MockCSSStyleDeclaration({
          "background-color": "rgb(255, 255, 255)"
        }));

        assert.deepEqual(existing, {
            "background-color": { "specificity": 1, "value": "rgb(255, 255, 255)" }
          },
          "creates the general object pattern we were expecting"
        );

        visual._specificityAdd(11, existing, new MockCSSStyleDeclaration({
          "padding": "5px"
        }));

        assert.deepEqual(existing, {
            "background-color": { "specificity": 1, "value": "rgb(255, 255, 255)" },
            "padding": { "specificity": 11, "value": "5px" }
          },
          "continues to add styles to the list"
        );

        visual._specificityAdd(11, existing, new MockCSSStyleDeclaration({
          "padding": "10px"
        }));

        assert.deepEqual(existing, {
            "background-color": { "specificity": 1, "value": "rgb(255, 255, 255)" },
            "padding": { "specificity": 11, "value": "10px" }
          },
          "Overwrites values when new style's specificities are at least as much"
        );

        visual._specificityAdd(1, existing, new MockCSSStyleDeclaration({
          "padding": "5px"
        }));

        assert.deepEqual(existing, {
            "background-color": { "specificity": 1, "value": "rgb(255, 255, 255)" },
            "padding": { "specificity": 11, "value": "10px" }
          },
          "New styles with lower specificity are not added to the list"
        );
      });


      QUnit.test("_uniformName() "+
        "Removes -value suffixes", function(assert) {
        assert.equal(visual._uniformName("border-right"), "border-right",
          "Values without -value are completely ignored"
        );

        assert.equal(visual._uniformName("some-value-foo"), "some-value-foo",
          "Values with -value, but not at the end, are ignored"
        );

        assert.equal(visual._uniformName("margin-value"), "margin",
          "Values ending in -value have the -value part removed"
        );
      });


      QUnit.test("_equalValues() " +
        "Identifies when the specified values in an Array are equal", function(assert) {
        assert.strictEqual(
          visual._equalValues({
            a: 1,
            b: 1,
            c: 2
          }, ["a", "b"]),
          true,
          "a and b have equal values"
        );

        assert.strictEqual(
          visual._equalValues({
            a: 1,
            b: 1,
            c: 2
          }, ["a", "b", "c"]),
          false,
          "a, b and c do not all have equal values"
        );

        assert.strictEqual(visual._equalValues({
            a: 1,
            b: 1,
            c: "1"
          }, ["a", "b", "c"]),
          false,
          "a, b and c do not all have strictly equal values"
        );
      });


      /**
       * Public method tests.
       */


      // Not implemented
      //QUnit.test("#textsDiffer()");


      QUnit.test("elemsDiffer() " +
        "identifies when elements are visually different", function(assert) {
        var $a = $("#foo"),
            $aWrapper = $("foo-wrapper"),
            $b = $("#bar"),
            a = $a.get(0),
            b = $b.get(0);

        assert.strictEqual(visual.elemsDiffer(a, a), null,
          "Comparing one element with itself returns no differences"
        );

        assert.strictEqual(visual.elemsDiffer(a, b), null,
          "Two visually identical elements returns no differences"
        );

        $a.addClass("color");

        assert.deepEqual(visual.elemsDiffer(a, b), {
            "a": { "color": "rgb(17, 17, 17)" },
            "b": { "color": "rgb(0, 0, 0)" }
          },
          "Elements with different colours returns their differences"
        );

        $a.removeClass();
        $aWrapper.addClass("width");

        assert.strictEqual(visual.elemsDiffer(a, b), null,
          "Visually different elements due to a parent returns no difference"
        );
      });

      QUnit.start();
    });
  });
})();
