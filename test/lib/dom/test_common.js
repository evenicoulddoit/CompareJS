(function() { "use strict";
  QUnit.stop();

  require(["config"], function() {
    require(["dom/common"], function(common) {

      QUnit.module("dom/common", {
        setup: function() {
          $("body").append(
            "<div id=\"test-container\"> " +
              "<div id=\"foo\" class=\"bar\"> " +
                "before " +
                "<span></span> " +
                "after " +
              "</div> " +
            "</div>"
          );
        },
        teardown: function() {
          $("#test-container").remove();
        }
      });


      QUnit.test("isNode() " +
        "Identifies DOM nodes", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0);

        assert.strictEqual(common.isNode(foo), true,
          "An element is a node"
        );

        assert.strictEqual(common.isNode(foo.childNodes[0]), true,
          "A text node is a node"
        );

        assert.strictEqual(common.isNode(null), false,
          "A null is not a node"
        );

        assert.strictEqual(common.isNode("node"), false,
          "A string is not a node"
        );
      });


      QUnit.test("nodeType() " +
        "Identifies the type of a node", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0);

        assert.equal(common.nodeType(foo), "element",
          "Identifies an element node"
        );

        assert.equal(common.nodeType(foo.childNodes[0]), "text",
          "Identifies a text node"
        );

        assert.throws(function() {
            common.nodeType("not a node");
          },
          "Non-nodes cause an error to be thrown"
        );
      });


      QUnit.test("signature() " +
        "Identifies element signature and stores for later use", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0),
            expected = "<div class=\"bar\" id=\"foo\">before after</div>";

        assert.equal(common.signature(foo), expected,
          "Attributes sorted alphabetically, text node trimmed, start and end tags"
        );

        assert.equal(foo._sig, expected,
          "The signature is also stored as a property of the element"
        );

        assert.equal(foo._tagSig,
          "<div class=\"bar\" id=\"foo\">",
          "The tag section of the signature is stored"
        );

        assert.equal(foo._attrStr,
          " class=\"bar\" id=\"foo\"",
          "The attribute section of the signature is stored"
        );

        assert.equal(foo._textStr,
          "before after",
          "The text section of the signature is stored, trimmed"
        );
      });


      QUnit.test("getTextStr() " +
        "Combines all text nodes for a given element, and trims them", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0);

        assert.equal(common.getTextStr(foo), "before after",
          "Text nodes trimmed, and combined"
        );
      });


      QUnit.test("getAttr() " +
        "Combines all attributes for a given element, alphabetically", function(assert) {
        var $foo = $("#foo"),
            foo = $foo.get(0);

        assert.equal(common.getAttrStr(foo),
          " class=\"bar\" id=\"foo\"",
          "Ordered correctly and all atttributes accounted for"
        );
      });

      QUnit.start();
    });
  });
})();
