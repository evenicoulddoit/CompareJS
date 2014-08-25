(function() { "use strict";
  QUnit.stop();

  require(["config"], function() {
    require(["dom/traversal"], function(traversal) {

      QUnit.module("dom/traversal", {
        setup: function() {
          $("body").append(
            "<div id=\"test-container\"> " +
              "<div id=\"foo\" class=\"bar\"> " +
                "before " +
                "<span id=\"zulu\"></span> " +
                "after " +
              "</div> " +
              "<div id=\"bar\"></div>" +
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
          last: bar,
          stop: container,
          no_down: false,
          all: false
        };

        assert.strictEqual(traversal._goForward(opts), null,
          "When no more elements are available, returns null"
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
            { tag: "SPAN" }
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
            { attributes: { "id": "zulu" }}
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
            { attributes: { "id": "zulu", "class": "something-else" }}
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
              tag: "SPAN",
              attributes: { "id": "zulu" }
            }
          ]
        };

        assert.strictEqual(traversal.forward(opts), bar,
          "Exclusions can be a combination of tag names and attributes"
        );
      });


      QUnit.test("onExclusionList() " +
        "Gets the next element, ignoring exclusions.", function(assert) {
        var foo = $("#foo").get(0);

        assert.strictEqual(traversal.onExclusionList(foo, [
            { tag: "DIV" }
          ]),
          true,
          "A div is correctly identified as on an exclusion list"
        );

        assert.strictEqual(traversal.onExclusionList(foo, [
            { attributes: { "id": "foo" }}
          ]),
          true,
          "An element is correctly identified as excluded by attribute"
        );

        assert.strictEqual(traversal.onExclusionList(foo, [
            { attributes: { "id": "bar" }},
            { attributes: { "id": "foo" }}
          ]),
          true,
          "Identifies an exclusion when match is not the first"
        );

        assert.strictEqual(traversal.onExclusionList(foo, [
            { attributes: { "id": "bar" }},
          ]),
          false,
          "Non-matching exclusions return false"
        );
      });

      QUnit.start();
    });
  });
})();
