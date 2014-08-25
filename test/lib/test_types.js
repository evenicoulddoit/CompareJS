(function() { "use strict";
  QUnit.stop();

  require(["config"], function() {
    require(["types"], function(types) {

      QUnit.module("types");


      QUnit.test("MapList " +
        "Stores a list of elements from two trees ", function(assert) {

        var ml = new types.MapList();
        assert.ok(ml.a.length === 0, "The a tree is initially empty");
        assert.ok(ml.b.length === 0, "The b tree is initially empty");

        ml.push("a", "foo");

        assert.deepEqual(ml.a, ["foo"],
          "Pushing elements into the list stores them correctly"
        );
      });


      QUnit.start();
    });
  });
})();
