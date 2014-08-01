define([], function() { "use strict";
  /**
   * @constructor
   */
  function MapList() {
    this.a = [];
    this.b = [];
  }

  MapList.prototype.push = function(to, value) {
    this[to].push(value);
  };

  return {
    MapList: MapList
  };
});
