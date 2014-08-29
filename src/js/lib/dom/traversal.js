define(["dom/common", "regexp"], function(DOM, regexp) { "use strict";

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

  /**
   * Decide whether two elements' attributes have any differences other than
   * the ones explicitly marked as "to ignore".
   * @param  {Element} elemA
   * @param  {Element} elemB
   * @param  {Object} toIgnore - A list of attributes to ignore
   * @return {Boolean} - Whether, any attributes not explicitly marked have changed.
   */
  function attrsDiffer(elemA, elemB, toIgnore) {
    var checked = [],
        length = elemA.attributes.length,
        attrName, i, attrA, attrB, ignore, strippedA, strippedB;

    // Check that each A attribute is either equal to B or is excluded
    for(i = 0; i < length; i++) {
      attrName = elemA.attributes[i].name;
      attrA = elemA.getAttribute(attrName);
      attrB = elemB.getAttribute(attrName);
      checked.push(attrName);

      // We've got an attibute change
      if(attrA !== attrB) {
        ignore = toIgnore[attrName];

        // It's not on our exclusion list
        if(ignore === undefined) {
          return true;
        }

        // It's on our exclusion list, but the exclusion is a regex, and
        // when we remove the matched groups, they're still not equal
        else if(ignore instanceof RegExp) {
          strippedA = regexp.removeMatchGroups(attrA, ignore);
          strippedB = regexp.removeMatchGroups(attrB, ignore);

          // If, after removing the match groups, the elements are not equal, 
          if(strippedA !== strippedB) {
            return true;
          }
        }
      }
    }

    length = elemB.attributes.length;

    // Check that any added B attributes are excluded
    for(i = 0; i < length; i++) {
      attrName = elemB.attributes[i].name;

      // We've found an attribute of B which A didn't have - if it's not
      // marked as an attribute we should ignore completely, return false
      if(checked.indexOf(attrName) == -1 && toIgnore[attrName] !== "*") {
        return true;
      }
    }

    return false;
  }

  var exports = {
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

      if(forward !== null && DOM.nodeType(forward) == "element" && 
         opts.exclude &&
         this.exclusionMatch(forward, opts.exclude)) {
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
     * Return whether an element matches any of the provided list of exclusions.
     * If another element is provided, then all of the differences been the
     * elements must also match those marked as "to ignore" in an exclusion
     * @param  {Element} elem
     * @param  {Array} list - The list of exclusion objects
     * @param  {Element} [otherElem] - Another element to compare ignored changes against
     * @return {Boolean} - Whether the element should be excluded or not
     */
    exclusionMatch: function(elem, exclusions, otherElem) {
      var excludeCount = exclusions.length,
          exclude, match, ignore, i, attr;

      outer:
      for(i = 0; i < excludeCount; i++) {
        exclude = exclusions[i];
        match = exclude.match;
        ignore = exclude.ignore;

        // If this exclusion is an element and an exact match, exclude.
        if(DOM.isNode(exclude) && DOM.nodeType(exclude) === "element") {
          if(exclude === elem) {
            return true;
          }
          else {
            continue;
          }
        }

        // If match lists a tag name which doesn't match the current element, ignore.
        if(match.hasOwnProperty("tag") && match.tag !== elem.tagName) {
          continue;
        }

        // If match lists attributes 
        if(match.hasOwnProperty("attributes")) {
          for(attr in match.attributes) {
            if(match.attributes[attr] !== elem.getAttribute(attr)) {
              continue outer;
            }
          }
        }

        // If this exclusion lists certain aspects to ignore, and we have a
        // second element to compare against, we calculate if the only
        // differences between the elements are those which we should ignore.
        if(typeof ignore === "object" && otherElem) {
          if(typeof ignore.attributes === "object" &&
             attrsDiffer(elem, otherElem, ignore.attributes)) {
            continue;
          }
        }
        return true;
      }
      return false;
    }
  };

  //>>includeStart("test", pragmas.test)
  exports._goForward = goForward;
  exports._previousElement = previousElement;
  exports._nextElement = nextElement;
  exports._getFirstChild = getFirstChild;
  exports._getLastChild = getLastChild;
  exports._attrsDiffer = attrsDiffer;
  //>>includeEnd("test")

  return exports;
});
