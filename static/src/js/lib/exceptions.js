define([], function() { "use strict";

  /**
   * Define a custom error, to throw when we reach our difference limit
   * @param {string} message
   */
  function LimitError(message) {
    this.name = "ReachedLimitError";
    this.message = message;
    this.stack = (new Error()).stack;
  }

  LimitError.prototype = Object.create(Error.prototype);

  return {
    LimitError: LimitError
  };
});
