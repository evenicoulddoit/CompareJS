(function() { "use strict";
  QUnit.stop();

  require(["config"], function() {
    require(["dom/traversal"], function(traversal) {

      QUnit.module("dom/traversal", {
        setup: function() {
          $("body").append(
            "<div id=\"test-container\"> " +
              "<div id=\"foo\"> " +
                "before " +
                "<span id=\"zulu\"></span> " +
                "after " +
              "</div> " +
              "<div id=\"bar\">" +
                "<strong class=\"s-1\"></strong>" +
                "<strong class=\"s-2\"></strong>" +
              "</div>" +
            "</div>"
          );
        },
        teardown: function() {
          $("#test-container").remove();
        }
      });


      QUnit.test("_goForward() " +
        "Retrieves the next element, depending on provided options", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0),
            bar = $("#bar").get(0),
            firstNode = foo.childNodes[0],
            span = foo.children[0],
            nextNode = foo.nextSibling,
            container = $("#test-container").get(0),
            opts;

        opts = {
          last: foo,
          stop: container,
          no_down: false,
          all: false
        };

        assert.strictEqual(traversal._goForward(opts), span,
          "Default options return next element node"
        );

        opts = {
          last: foo,
          stop: container,
          no_down: false,
          all: true
        };


        assert.strictEqual(traversal._goForward(opts), firstNode,
          "When the all flag is set to true, returns next node of any kind"
        );

        opts = {
          last: foo,
          stop: container,
          no_down: true,
          all: false
        };

        assert.strictEqual(traversal._goForward(opts), bar,
          "When the all no_down is set to true, return the next node"
        );

        opts = {
          last: foo,
          stop: container,
          no_down: true,
          all: true
        };

        assert.strictEqual(traversal._goForward(opts), nextNode,
          "When the all no_down is set to true, and not all return the next element"
        );

        opts = {
          last: span,
          stop: container,
          no_down: false,
          all: false
        };

        assert.strictEqual(traversal._goForward(opts), bar,
          "When no siblings are left, traverse upwards"
        );

        opts = {
          last: $(".s-2", container).get(0),
          stop: container,
          no_down: false,
          all: false
        };

        assert.strictEqual(traversal._goForward(opts), null,
          "When no more elements are available, returns null"
        );
      });


      QUnit.test("_attrsDiffer()" +
        "Identifies differences between elements attributes", function(assert) {

        var $foo = $("#foo"),
            foo = $foo.get(0),
            bar = document.getElementById("bar"),
            toIgnore = {};

        assert.strictEqual(traversal._attrsDiffer(foo, foo, toIgnore), false,
          "When comparing an element with itself, no differences are reported"
        );

        assert.strictEqual(traversal._attrsDiffer(foo, bar, toIgnore), true,
          "Elements with different attributes are identified"
        );

        toIgnore = {
          "id": "*", 
        };

        assert.strictEqual(traversal._attrsDiffer(foo, bar, toIgnore), false,
          "When ignoring an attribute difference, no differences are reported"
        );

        toIgnore = {
          "id": /nomatch/
        };

        assert.strictEqual(traversal._attrsDiffer(foo, bar, toIgnore), true,
          "RegExp differences which don't match result in differences reported"
        );

        toIgnore = {
          "id": /(foo|bar)/
        };

        assert.strictEqual(traversal._attrsDiffer(foo, bar, toIgnore), false,
          "RegExp differences which do match result in no differences reported"
        );
      });


      QUnit.test("forward() " +
        "Gets the next element, ignoring exclusions.", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0),
            bar = $("#bar").get(0),
            span = foo.children[0],
            container = $("#test-container").get(0),
            opts;

        opts = {
          last: foo,
          stop: container,
          no_down: false,
          all: false
        };

        assert.strictEqual(traversal.forward(opts), span,
          "Default options return next element node"
        );

        opts = {
          last: foo,
          stop: container,
          no_down: false,
          all: false,
          exclude: [
            { match: { tag: "SPAN"  }}
          ]
        };

        assert.strictEqual(traversal.forward(opts), bar,
          "Exclusions are recognised by tag name"
        );

        opts = {
          last: foo,
          stop: container,
          no_down: false,
          all: false,
          exclude: [
            { match: { attributes: { "id": "zulu" }} }
          ]
        };

        assert.strictEqual(traversal.forward(opts), bar,
          "Exclusions are recognised by attribute"
        );

        opts = {
          last: foo,
          stop: container,
          no_down: false,
          all: false,
          exclude: [
            { match: { attributes: { "id": "zulu", "class": "something-else" }}}
          ]
        };

        assert.strictEqual(traversal.forward(opts), span,
          "All attributes must be met to be a valid exclusion"
        );

        opts = {
          last: foo,
          stop: container,
          no_down: false,
          all: false,
          exclude: [
            {
              match: {
                tag: "SPAN",
                attributes: { "id": "zulu" }
              }
            }
          ]
        };

        assert.strictEqual(traversal.forward(opts), bar,
          "Exclusions can be a combination of tag names and attributes"
        );
      });


      QUnit.test("nextOrParent() " +
        "Get either the next element sibling, or parent.", function(assert) {

        assert.strictEqual(traversal.nextOrParent($(".s-1", "#test-container").get(0)),
          $(".s-2", "#test-container").get(0),
          "When a sibling is available, returns it"
        );

        assert.strictEqual(traversal.nextOrParent($("#zulu").get(0)),
          $("#foo").get(0),
          "When no siblings are available, returns the parent"
        );

      });


      QUnit.test("exclusionMatch() " +
        "Determines if an element matches a list of exclusions.", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0),
            $bar = $("#bar"),
            bar = $bar.get(0),
            exclusions = [];


        exclusions = [
          { match: { tag: "DIV" }}
        ];

        assert.strictEqual(traversal.exclusionMatch(foo, exclusions), true,
          "A div is correctly identified as on an exclusion list"
        );

        exclusions = [
          { match: { attributes: { "id": "foo" }}}
        ];

        assert.strictEqual(traversal.exclusionMatch(foo, exclusions), true,
          "An element is correctly identified as excluded by attribute"
        );

        exclusions = [
          { match: { attributes: { "id": "bar" }}},
          { match: { attributes: { "id": "foo" }}}
        ];

        assert.strictEqual(traversal.exclusionMatch(foo, exclusions), true,
          "Identifies an exclusion when match is not the first"
        );

        exclusions = [
          { match: { attributes: { "id": "bar" }}},
        ];

        assert.strictEqual(traversal.exclusionMatch(foo, exclusions), false,
          "Non-matching exclusions return false"
        );

        exclusions = [{
          match: {
            tag: "DIV"
          },
          ignore: {
            attributes: {
              "id": /(shouldntmatter)/
            }
          }
        }];

        assert.strictEqual(traversal.exclusionMatch(foo, exclusions, foo), true,
          "Second identical element, if match exists, ignores irrelevant, returns true"
        );

        exclusions = [{
          match: {
            tag: "DIV"
          },
          ignore: {
            attributes: {
              "class": "*"
            }
          }
        }];

        assert.strictEqual(traversal.exclusionMatch(foo, exclusions, bar), false,
          "Second element, and differences between non-ignored attributes, returns false"
        );

        exclusions = [{
          match: {
            tag: "DIV"
          },
          ignore: {
            attributes: {
              "id": "*"
            }
          }
        }];

        assert.strictEqual(traversal.exclusionMatch(foo, exclusions, bar), true,
          "Second element, no differences between non-ignored attributes, returns true"
        );
      });

      QUnit.start();
    });
  });
})();
