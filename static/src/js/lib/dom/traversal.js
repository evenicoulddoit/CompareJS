define([], function() { "use strict";

  function goForward(opts) {
    var last = opts.last, forward;

    // Down
    if(!opts.no_down) {
      forward = getFirstChild(last, opts.all);
      if(forward) return forward;
    }

    opts.no_down = false;

    // Along
    forward = nextElement(last, opts.all);
    if(forward) return forward;

    // Up
    while(last != opts.stop) {
      last = last.parentNode;
      if(last == opts.stop) return null;

      forward = nextElement(last, opts.all);
      if(forward) return forward;
    }
  }

  function previousElement(from, any) {
    if(any) return from.previousSibling;
    return from.previousElementSibling;
  }

  function nextElement(from, any) {
    if(any) return from.nextSibling;
    return from.nextElementSibling;
  }

  function getFirstChild(from, any) {
    if(any && from.childNodes.length) {
      return from.childNodes[0];
    }
    else if(!any && from.children.length) {
      return from.children[0];
    }
    return null;
  }

  function getLastChild(from, any) {
    if(any && from.childNodes.length) {
      return from.childNodes[from.childNodes.length - 1];
    }
    else if(!any && from.children.length) {
      return from.children[from.children.length-1];
    }
    return null;
  }

  return {
    /**
     * Get the next node given the previous.
     * Stop if we bubble back up to the initial parent.
     * We first look down, then along, then up.
     * @param {Node} [last] - If undefined, returns stop's firstChild
     * @param {Node} stop
     * @returns {Node|null}
     * @memberof Compare
     */
    forward: function(opts) {
      var forward;

      if(!opts.last) {
        opts.last = opts.stop;
        return this.forward(opts);
      }

      forward = goForward(opts);
      if(forward !== null && opts.exclude &&
         this.onExclusionList(forward, opts.exclude)) {
        opts.no_down = true;
        opts.last = forward;
        return this.forward(opts);
      }

      return forward;
    },

    /**
     * 
     */
    back: function(last, stop, any) {
      var back;

      if(!last) return this.back(stop, stop, any);

      // Down
      back = getLastChild(last, any);
      if(back) return back;

      // Along
      back = previousElement(last, any);
      if(back) return back;

      // Up
      while(last != stop) {
        last = last.parentNode;
        if(last == stop) return null;

        back = previousElement(last, any);
        if(back) return back;
      }
    },

    /**
     * Return whether an element matches any of the provided list of exclusions
     * @param  {Element} elem
     * @param  {Array} list - The list of exclusion objecta
     * @return {Object|Boolean} - Either the exclusion rule or false
     */
    onExclusionList: function(elem, list) {
      var exclude_length = list.length,
          exclude, i, attr;

      outer:
      for(i = 0; i < exclude_length; i++) {
        exclude = list[i];

        if(exclude.hasOwnProperty("tag") && exclude.tag !== elem.tagName) {
          continue;
        }
        if(exclude.hasOwnProperty("attributes")) {
          for(attr in exclude.attributes) {
            if(exclude.attributes[attr] !== elem.getAttribute(attr)) {
              continue outer;
            }
          }
        }
        return exclude;
      }
      return false;
    }
  };
});
