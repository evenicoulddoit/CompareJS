(function() { "use strict";
  QUnit.stop();

  /**
   * Mock a CSSRule object
   * @param {Object} properties - A list of properties to use
   * @param {MockCSSStyleDeclaration} properties.style
   * @param {String} [properties.src] - The source CSS file URL
   * @param {String} [properties.selector] - The selector text used
   */
  function MockCSSRule(props) {
    this.parentStyleSheet = { href: (props.src || null) };
    this.selectorText = props.selector || "*";
    this.style = props.style;
  }

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

  /**
   * Inspired by http://bit.ly/1mLYevv
   * @param  {string} hex - A hexadecimal colour
   * @return {string} - The RGB variant
   */
  function hexToRgb(hex) {
      // Expand shorthand form (e.g. "03F") to full form (e.g. "0033FF")
      var shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
      hex = hex.replace(shorthandRegex, function(m, r, g, b) {
          return r + r + g + g + b + b;
      });

      var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return "rgb(" + parseInt(result[1], 16) + ", " +
                      parseInt(result[2], 16) + ", " +
                      parseInt(result[3], 16) + ")";
  }

  /**
   * Calculate whether this browser converts color style declarations.
   * Currently IE doesn't convert color but it _does_ background-color.
   * All other browsers convert all to rgb.
   * @return {function} - A method to convert colours approrpiately
   */
  var browserColourFn = (function() {
    var $style = $("<style id='tmp-styles'> div { color: #000; } </style>").appendTo("body"),
        style = $style.get(0),
        styleSheets = document.styleSheets,
        sheetCount = styleSheets.length,
        fn = function(x) { return x },
        i;

    for(i = 0; i < sheetCount; i++) {
      if(styleSheets[i].ownerNode === style) {
        if(styleSheets[i].cssRules[0].style.getPropertyValue("color").indexOf("rgb") === 0) {
          fn = hexToRgb;
        }
        break;
      }
    }

    $style.remove();
    return fn;
  })();


  require(["config"], function() {
    require(["dom/visual"], function(visual) {

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
          "The correct keys are removed from the object"
        );
      });


      QUnit.test("_shorthandMarginPadding() " +
        "Combines margin and padding rules of the same value", function(assert) {

        // All identical margin rules, combine into one.
        // Leave the other rules as they are
        var identical = {
          "margin-top": { "value": "5px" },
          "margin-right": { "value": "5px" },
          "margin-bottom": { "value": "5px" },
          "margin-left": { "value": "5px" },
          "a-rule": { "value": "to-ignore" }
        };

        assert.deepEqual(visual._shorthandMarginPadding(identical), {
            "margin": { "value": "5px" },
            "a-rule": { "value": "to-ignore" }
          },
          "All equal margin values are combined into 1 value."
        );

        var diffSelector = {
          "margin-top": { "value": "5px" },
          "margin-right": { "value": "5px", "selector": "different" },
          "margin-bottom": { "value": "5px" },
          "margin-left": { "value": "5px" },
        };

        assert.deepEqual(visual._shorthandMarginPadding(diffSelector), diffSelector,
          "If any rules come from a different selector, don't combine at all"
        );

        var diffSrc = {
          "margin-top": { "value": "5px" },
          "margin-right": { "value": "5px", "src": "different" },
          "margin-bottom": { "value": "5px" },
          "margin-left": { "value": "5px" },
        };

        assert.deepEqual(visual._shorthandMarginPadding(diffSrc), diffSrc,
          "If any rules come from a different stylesheet, don't combine at all"
        );

        var twoValue = {
          "padding-top": { "value": "5px" },
          "padding-right": { "value": "10px" },
          "padding-bottom": { "value": "5px" },
          "padding-left": { "value": "10px" }
        };

        assert.deepEqual(visual._shorthandMarginPadding(twoValue), {
            "padding": { "value": "5px 10px" }
          },
          "Equal horizontal and vertical padding values are combined into 2 values."
        );

        var threeValue = {
          "margin-top": { "value": "5px" },
          "margin-right": { "value": "10px" },
          "margin-bottom": { "value": "15px" },
          "margin-left": { "value": "10px" }
        };

        assert.deepEqual(visual._shorthandMarginPadding(threeValue), {
            "margin": { "value": "5px 10px 15px" }
          },
          "Equal left and right margin values are combined into 3 values."
        );

        var fourValue = {
          "padding-top": { "value": "5px" },
          "padding-right": { "value": "10px" },
          "padding-bottom": { "value": "15px" },
          "padding-left": { "value": "20px" }
        };

        assert.deepEqual(visual._shorthandMarginPadding(fourValue), {
            "padding": { "value": "5px 10px 15px 20px" }
          },
          "All different padding values are combined into 4 values."
        );

        var missingOne = {
          "margin-top": { "value": "5px" },
          "margin-right": { "value": "10px" },
          "margin-bottom": { "value": "15px" }
        };

        assert.deepEqual(visual._shorthandMarginPadding(missingOne), missingOne,
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
        assert.deepEqual(differences, {},
          "Identical elements report no differences"
        );

        $a.addClass("color");
        differences = visual._styleRuleDifferences(a, b);
        assert.deepEqual(differences, {
            "color": {
              "a": {
                "value": browserColourFn("#111"),
                "src": null,
                "selector": ".color",
                "specificity": 10
              },
              "b": {
                "value": browserColourFn("#000"),
                "src": null,
                "selector": "div",
                "specificity": 1
              }
            }
          },
          "Adding a class to A which changes its color is recognised"
        );

        $b.addClass("display");
        differences = visual._styleRuleDifferences(a, b);

        assert.deepEqual(differences.display, {
              "a": {
                "value": "block",
                "src": null,
                "selector": "div",
                "specificity": 1
              },
              "b": {
                "value": "inline-block",
                "src": null,
                "selector": ".display",
                "specificity": 10
              }
            },
          "Adding a class to B which changes its display is recognised"
        );

        assert.strictEqual(Object.keys(differences).length, 2,
          "The correct number of differences are reported"
        );

        $a.attr("class", "background-color");
        $b.removeClass();
        differences = visual._styleRuleDifferences(a, b);
        assert.deepEqual(differences, {
          "background-color": {
              "a": {
                    "value": hexToRgb("#eee"),
                    "src": null,
                    "selector": ".background-color",
                    "specificity": 10
              },
              "b": undefined,
            }
          },
          "Adding a rule to A which B doesn't have returns undefined for B"
        );
      });


      QUnit.test("_findRulesFor() " +
        "Finds the rules / specificity for a given element", function(assert) {
        var $a = $("#foo"),
            a = $a.get(0);

        assert.deepEqual(visual._findRulesFor(a), {
            "display": {
              "specificity": 1,
              "src": null,
              "selector": "div",
              "value": "block"
            },
            "font-weight": {
              "specificity": 1,
              "src": null,
              "selector": "div",
              "value": "400"
            },
            "color": {
              "specificity": 1,
              "src": null,
              "selector": "div",
              "value": browserColourFn("#000")
            }
          },
          "Checking against the element #foo retrieves all the div styles"
        );

        $a.addClass("position");
        assert.deepEqual(visual._findRulesFor(a), {
            "display": {
              "specificity": 1,
              "value": "block",
              "selector": "div",
              "src": null
            },
            "font-weight": {
              "specificity": 1,
              "value": "400",
              "selector": "div",
              "src": null
            },
            "color": {
              "specificity": 1,
              "value": browserColourFn("#000"),
              "selector": "div",
              "src": null
            },
            "position": {
              "specificity": 11,
              "value": "absolute",
              "selector": "div.position",
              "src": null
            }
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

        var existing = {},
            rule;

        rule = new MockCSSRule({
          src: "a.css",
          selector: "div",
          style: new MockCSSStyleDeclaration({
            "background-color": "rgb(255, 255, 255)"
          })
        });

        visual._specificityAdd(1, existing, rule);

        assert.deepEqual(existing, {
            "background-color": {
              "specificity": 1,
              "value": "rgb(255, 255, 255)",
              "src": "a.css",
              "selector": "div"
            }
          },
          "creates the general object pattern we were expecting"
        );

        rule = new MockCSSRule({
          src: "b.css",
          selector: "#foo div",
          style: new MockCSSStyleDeclaration({
            "padding": "5px"
          })
        });

        visual._specificityAdd(11, existing, rule);

        assert.deepEqual(existing, {
            "background-color": {
              "specificity": 1,
              "value": "rgb(255, 255, 255)",
              "src": "a.css",
              "selector": "div"
            },
            "padding": {
              "specificity": 11,
              "value": "5px",
              "src": "b.css",
              "selector": "#foo div"
            }
          },
          "continues to add styles to the list"
        );

        rule = new MockCSSRule({
          src: "c.css",
          selector: "#foo .bar",
          style: new MockCSSStyleDeclaration({
            "padding": "10px"
          })
        });

        visual._specificityAdd(11, existing, rule);

        assert.deepEqual(existing, {
            "background-color": {
              "specificity": 1,
              "value": "rgb(255, 255, 255)",
              "src": "a.css",
              "selector": "div"
            },
            "padding": {
              "specificity": 11,
              "value": "10px",
              "src": "c.css",
              "selector": "#foo .bar"
            }
          },
          "Overwrites values when new style's specificities are at least as much"
        );

        rule = new MockCSSRule({
          src: "d.css",
          selector: ".bar",
          style: new MockCSSStyleDeclaration({
            "padding": "10px"
          })
        });

        visual._specificityAdd(1, existing, rule);

        assert.deepEqual(existing, {
            "background-color": {
              "specificity": 1,
              "value": "rgb(255, 255, 255)",
              "src": "a.css",
              "selector": "div"
            },
            "padding": {
              "specificity": 11,
              "value": "10px",
              "src": "c.css",
              "selector": "#foo .bar"
            }
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
            a: { "value": 1 },
            b: { "value": 1, },
            c: { "value": 2 }
          }, ["a", "b"]),
          true,
          "a and b have equal values"
        );

        assert.strictEqual(
          visual._equalValues({
            a: { "value": 1, },
            b: { "value": 1, },
            c: { "value": 2 }
          }, ["a", "b", "c"]),
          false,
          "a, b and c do not all have equal values"
        );

        assert.strictEqual(visual._equalValues({
            a: { "value": 1, },
            b: { "value": 1, },
            c: { "value": "1" }
          }, ["a", "b", "c"]),
          false,
          "a, b and c do not all have strictly equal values"
        );

        assert.strictEqual(visual._equalValues({
            a: { "inner": 1, },
            b: { "inner": 1, },
            c: { "inner": "1" }
          }, ["a", "b", "c"], "inner"),
          false,
          "Changing the inner key works as expected"
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
            "a": {
              "color": {
                "value": browserColourFn("#111"),
                "selector": ".color",
                "src": null,
                "specificity": 10
              }
            },
            "b": {
              "color": {
                "value": browserColourFn("#000"),
                "selector": "div",
                "src": null,
                "specificity": 1
              }
            }
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
