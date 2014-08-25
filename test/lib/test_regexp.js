(function() { "use strict";
  QUnit.stop();

  require(["config"], function() {
    require(["regexp"], function(regexp) {

      QUnit.module("regexp");


      QUnit.test("removeMatchGroups() " +
        "Removes all matched groups from a string ", function(assert) {

        var re = /([0-9]+\-)[a-z]+(\.html?)/i;

        assert.equal(regexp.removeMatchGroups("1337-match.html", re), "match",
          "When a match is found, all matched groups are removed"
        );

        assert.equal(regexp.removeMatchGroups("no-match", re), "no-match",
          "When no match is found, the original string is returned"
        );
      });

      QUnit.start();
    });
  });
})();
