(function() { "use strict";
  QUnit.stop();

  require(["config"], function() {
    require(["app/model"], function(Compare) {

      QUnit.module("app/model", {
        setup: function() {
          var $container = $(
            "<div class='test-container'> " +
              "<span>span</span>" +
              "<a href=\"url\">" +
                "<img src=\"image\" alt=\"sample image\" />" +
              "</a>" +
              "<pre> spaces important </pre> " +
              "<strong title=\"important\">bold</strong>" +
              "<em></em>" +
            "</div>"
          );

          $("body").append($container).append($container.clone());
        },
        teardown: function() {
          $(".test-container").remove();
        }
      });


      QUnit.test("Compare() " +
        "Reports no differences when identical DOMs are compared", function(assert) {
        var $a = $(".test-container").eq(0),
            $b = $(".test-container").eq(1),
            compare;

        compare = new Compare({
          a: $a.get(0),
          b: $a.get(0)
        });

        assert.equal(compare.differenceCount, 0,
          "Difference count is 0 when a DOM tree is compared with itself"
        );

        compare = new Compare({
          a: $a.get(0),
          b: $b.get(0)
        });

        assert.equal(compare.differenceCount, 0,
          "Difference count is 0 when identical DOM trees are compared"
        );
      });


      QUnit.test("Compare() " +
        "Reports when elements are removed / added from the DOM", function(assert) {
        var $a = $(".test-container").eq(0),
            a = $a.get(0),
            $b = $(".test-container").eq(1),
            b = $b.get(0),
            compare;

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
        var $a = $(".test-container").eq(0),
            a = $a.get(0),
            $b = $(".test-container").eq(1),
            b = $b.get(0),
            compare;

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
        var $a = $(".test-container").eq(0),
            a = $a.get(0),
            $b = $(".test-container").eq(1),
            b = $b.get(0), compare;

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
        var $a = $(".test-container").eq(0),
            a = $a.get(0),
            $b = $(".test-container").eq(1),
            b = $b.get(0), compare;

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
        var $a = $(".test-container").eq(0),
            a = $a.get(0),
            $b = $(".test-container").eq(1),
            b = $b.get(0), compare;

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
        $("pre", $b).before($("strong", $b));

        compare = new Compare({
          a: a,
          b: b
        });

        // Because we swapped the elements around, this generates 2 more
        // differences. When an element is found in a position different from
        // where it used to be, we check to see if the element following it
        // has also changed. If it has, we deduce that the element has been moved
        // Therefore when you swap elements around, they are both followed by
        // different elements, and hence, have moved.
        assert.equal(compare.differenceCount, 3,
          "Moving a further element results in 2 more changes being reported"
        );

        // The order isn't really important
        assert.deepEqual(compare.differences.moved, [
            [$("strong", $a).get(0), $("strong", $b).get(0)],
            [$("pre", $a).get(0), $("pre", $b).get(0)],
            [$("em", $a).get(0), $("em", $b).get(0)]
          ],
          "The correct elements are reported as having been moved"
        );
      });


      QUnit.start();
    });
  });
})();
