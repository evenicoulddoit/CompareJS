(function() { "use strict";
  QUnit.stop();

  require(["config"], function() {
    require(["app/model"], function(Compare) {

      var $a, a, $b, b, compare;

      QUnit.module("app/model", {
        setup: function() {
          var $container = $(
            "<div id=\"container-a\" class=\"test-container\">" +
              "<div class=\"body\"> " +
                "<span>span</span>" +
                "<a href=\"url\">" +
                  "<img src=\"image\" alt=\"sample image\" />" +
                "</a>" +
                "<div class=\"container-1\">" +
                  "<pre> spaces important </pre> " +
                "</div>" +
                "<div class=\"container-2\">" +
                  "<strong title=\"important\">bold</strong>" +
                "</div>" +
                "<div class=\"container-3\">" +
                  "<u class=\"take-note\">underlined</u>" +
                "</div>" +
                "<em></em>" +
              "</div>" +
            "</div>"
          );

          $("body").append($container);
          $("body").append($container.clone().attr("id", "container-b"));

          // All tests have access to the A and B variables
          $a = $(".body", "#container-a");
          a = $a.get(0);
          $b = $(".body", "#container-b");
          b = $b.get(0);
        },
        teardown: function() {
          $(".test-container").remove();
        }
      });


      QUnit.test("Compare() " +
        "Reports no differences when identical DOMs are compared", function(assert) {
        compare = new Compare({
          a: a,
          b: a
        });

        assert.equal(compare.differenceCount, 0,
          "Difference count is 0 when a DOM tree is compared with itself"
        );

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 0,
          "Difference count is 0 when identical DOM trees are compared"
        );
      });


      QUnit.test("Compare() " +
        "Reports when elements are removed / added from the DOM", function(assert) {
        $("span", $a).remove();

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 1,
          "Difference count is one after removing the span from A"
        );

        assert.deepEqual(compare.differences.added, [
            [undefined, $("span", $b).get(0)]
          ],
          "The difference reported reports successfully that the span was added"
        );

        $("img", $b).remove();

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 2,
          "Difference count is two after removing the img from B"
        );

        assert.deepEqual(compare.differences.removed, [
            [$("img", $a).get(0), undefined]
          ],
          "The difference reported reports successfully that the img was removed"
        );
      });


      QUnit.test("Compare() " +
        "Reports when attributes are added / removed", function(assert) {
        $("img", $b).replaceWith("<img alt=\"sample image\" \n src=\"image\" />");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 0,
          "Rearranging attributes / adding spaces doesn't report any changes"
        );

        $("img", $b).addClass("new-class");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 1,
          "Adding a class attribute to an img is reported"
        );

        assert.deepEqual(compare.differences.attr, [
            [$("img", $a).get(0), $("img", $b).get(0)]
          ],
          "The correct elements are identified as having their attributes changed"
        );

        // Using vanilla JS so that the additional spaces remain
        $("img", $a).get(0).setAttribute("class", "  new-class");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 0,
          "Additional spaces in between classes are not reported as differences"
        );

        // Using vanilla JS so that the additional spaces remain
        $("img", $a).get(0).setAttribute("alt", "sample   image");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 1,
          "Additional spaces in between other attribute values are reported"
        );
      });


      QUnit.test("Compare() " +
        "Reports when element tag names change", function(assert) {
        $("span", $b).replaceWith("<div>span</div>");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 1,
          "Changing an elements tag is correctly picked up as a change"
        );

        assert.deepEqual(compare.differences.tag, [
            [$("span", $a).get(0), $("div", $b).get(0)]
          ],
          "The correct elements are reported as having changed"
        );
      });


      QUnit.test("Compare() " +
        "Reports when text nodes are added / removed / edited", function(assert) {
        $("strong", $b).text("boold");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 1,
          "Changing an elements text node is reported as a difference"
        );

        assert.deepEqual(compare.differences.text, [
            [$("strong", $a).get(0), $("strong", $b).get(0)]
          ],
          "The correct elements are reported as having changed"
        );

        $("a", $b).before("text node");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 2,
          "Adding a new text node at the root level is reported as a difference"
        );

        assert.deepEqual(compare.differences.text, [
            [a, b],
            [$("strong", $a).get(0), $("strong", $b).get(0)]
          ],
          "The correct elements are reported as having changed"
        );

        $("em", $b).text("emphasised!");

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 3,
          "Adding a new text node at other levels are reported"
        );

        assert.deepEqual(compare.differences.text, [
            [a, b],
            [$("strong", $a).get(0), $("strong", $b).get(0)],
            [$("em", $a).get(0), $("em", $b).get(0)]
          ],
          "The correct elements are reported as having changed"
        );
      });


      QUnit.test("Compare() " +
        "Reports when elements are moved", function(assert) {

        // Move the em tag before the span
        $("span", $b).before($("em", $b));

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 1,
          "Moving an element results in a change being reported"
        );

        assert.deepEqual(compare.differences.moved, [
            [$("em", $a).get(0), $("em", $b).get(0)]
          ],
          "The correct elements are reported as having been moved"
        );

        // Swap the pre and the strong around
        $(".container-1", $b).before($(".container-2", $b));

        compare = new Compare({
          a: a,
          b: b
        });

        assert.equal(compare.differenceCount, 2,
          "Moving a further element results in another movement being reported"
        );

        // The order isn't really important
        assert.deepEqual(compare.differences.moved, [
            [$(".container-2", $a).get(0), $(".container-2", $b).get(0)],
            [$("em", $a).get(0), $("em", $b).get(0)]
          ],
          "The correct elements are reported as having been moved"
        );
      });


      QUnit.start();
    });
  });
})();
