/* =============================================================================
 * Compare.js
 * =============================================================================
 * Compares two different DOM trees, for element & differences
 * ===========================================================================*/

define(["types",
        "regexp",
        "dom/common",
        "dom/visual",
        "dom/traversal",
        "exceptions"],

function(types, regexp, DOM, visual, traverse, exceptions) { "use strict";

  /**
   * @constructor
   * @param {Element} a
   * @param {Element} b
   */
  function Compare(opts) {
    if(!opts.a || !opts.b) {
      throw new TypeError("You must supply both DOM tree A and B");
    }

    this.opts = opts;
    this.a = opts.a;
    this.b = opts.b;

    this.MAX_DIFFERENCES = opts.max_differences || 25;

    this.aStyleSheets = this.a.ownerDocument.styleSheets;
    this.bStyleSheets = this.b.ownerDocument.styleSheets;

    this.differenceCount = 0;
    this.differences = {
      tag: [],
      attr: [],
      removed: [],
      added: [],
      text: [],
      moved: [],
      space: [],
      style: []
    };

    this.parseExclusions();
    this.signatureMap = {};

    try {
      this._parseElements();
      this._processImbalances();
      this._findMovements();
    }
    catch(e) {
      if(!(e instanceof exceptions.LimitError)) {
        throw e;
      }
    }
  }

  Compare.prototype = {

    /**
     * Parse the list of elements / changes to exclude 
     */
    parseExclusions: function() {
      var length, i, exclude, match, ignore, attrs, attr;

      this.excludeCompletely = [];
      this.excludeChanges = [];

      if(this.opts.exclude instanceof Array) {
        length = this.opts.exclude.length;

        for(i = 0; i < length; i++) {
          exclude = this.opts.exclude[i];
          match = exclude.match;
          ignore = exclude.ignore;

          if(match) {

            // Force uppercase tagName to match element property
            if(typeof match.tag === "string") match.tag = match.tag.toUpperCase();

            // If what to ignore is not specified or explicitly set to all
            // We add the exclusion to the "ignore completely" list
            if(!ignore || ignore === "*") {
              this.excludeCompletely.push(exclude);
            }

            // If the element contains certain things to ignore, we parse any
            // regular expressions, and add the exclusion to the "exclude changes" list
            else {
              attrs = ignore.attributes;
              if(typeof attrs === "object") {
                for(attr in attrs) {

                  // We can either ignore certain attributes altogether, or
                  // provide a regular expression of what to ignore
                  if(attrs[attr] !== "*") {
                    try {
                      attrs[attr] = new RegExp(attrs[attr], "i");
                    }
                    catch(e) {
                      throw new SyntaxError("Failed to parse exception RegExp: " +
                                            attrs[attr]);
                    }
                  }
                }
              }
              this.excludeChanges.push(exclude);
            }
          }
        }
      }
    },

    /**
     * Parse the trees and create a map of element signatures -> elements in A and B
     */
    _parseElements: function() {
      var list, next, i, signature;

      ["a", "b"].forEach(function(tree) {
        i = 0;
        list = this["elems" + tree.toUpperCase()] = [];
        next = this[tree];

        while(next) {
          signature = DOM.signature(next);

          if(next._difference) {
            delete next._difference;
          }

          this.addToMap(next, tree);
          list.push(next);
          next._index = i;
          next = traverse.forward({
            last: i === 0 ? undefined : next,
            stop: this[tree],
            exclude: this.excludeCompletely
          });
          i ++;
        }

        this["total" + tree.toUpperCase()] = i;
      }, this);

    },

    /**
     * Find elements which have moved by traversing both node lists
     * TODO: refactor
     */
    _findMovements: function() {
      var missingA = {}, missingB = {},
          indexA = 0, indexB = 0,
          nextA, nextB, sigA, sigB, followedA, followedB;

      while(true) {
        nextA = this.elemsA[indexA];
        nextB = this.elemsB[indexB];

        if(!nextA && !nextB) break;

        sigA = nextA ? nextA._sig : "";
        sigB = nextB ? nextB._sig : "";

        // A and B are identical, keep looking
        if(sigA == sigB) {
          indexA ++;
          indexB ++;
        }

        else {

          // If either of A or B have been marked as added / removed, ignore
          if(nextA && nextA._difference === "removed") {
            indexA ++;
          }
          else if(nextB && nextB._difference === "added") {
            indexB ++;
          }

          // One of the mismatched elements has been seen before
          else if((sigA in missingA) || (sigB in missingB)) {

            // If the A element has been seen before, remove it from the list
            if(sigA in missingA) {
              followedA = (this.elemsA[indexB + 1] || {})._sig;
              followedB = (this.elemsB[missingA[sigA].index + 1] || {})._sig;

              // If element following A has changed, report A as having moved
              if(followedA !== followedB) {
                this._difference("moved", nextA, missingA[sigA].elem);
              }
              delete missingA[sigA];
              indexA ++;
            }

            // If the B element has been seen before, remove it from the list
            if(sigB in missingB) {
              followedA = (this.elemsA[missingB[sigB].index + 1] || {})._sig;
              followedB = (this.elemsB[indexA + 1] || {})._sig;

              // If element following B has changed, report B as having moved
              if(followedA !== followedB) {
                this._difference("moved", missingB[sigB].elem, nextB);
              }
              delete missingB[sigB];
              indexB ++;
            }
          }

          // We haven't seen either of these elements yet, store for later
          else {
            missingA[sigB] = { index: indexB, elem: nextB };
            missingB[sigA] = { index: indexA, elem: nextA };
            indexA ++;
            indexB ++;
          }
        }
      }
    },

    /**
     * Add an element to the element map
     */
    addToMap: function(elem, source) {
      var signature = DOM.signature(elem);
      if(!(signature in this.signatureMap)) {
        this.signatureMap[signature] = new types.MapList();
      }
      this.signatureMap[signature].push(source, elem);
    },

    /**
     * Loop through the signature map, and collect all cases in which the number
     * of A elements is different to the number of B elements. We then loop
     * through each of these and try to spot attribute / tagName changes. When
     * we find a probable match, we report and equate their signatures.
     */
    _processImbalances: function() {
      var imbalancesA = [],
          imbalancesB = [],
          signature, elems, elem, i, match;

      // Find all balanced elements, flatten into single lists
      for(signature in this.signatureMap) {
        elems = this.signatureMap[signature];
        if(elems.a.length != elems.b.length) {
          if(elems.a.length) Array.prototype.push.apply(imbalancesA, elems.a);
          if(elems.b.length) Array.prototype.push.apply(imbalancesB, elems.b);
        }
      }

      for(i = 0; i < imbalancesA.length; i ++) {
        elem = imbalancesA[i];
        match = this._findMatch(elem, imbalancesB);
        if(match) {

          // Report all non-exact matches which aren't in exclusions list
          if(match.type !== "identical" &&
             !traverse.exclusionMatch(elem, this.excludeChanges, match.elem)) {
            this._difference(match.type, elem, match.elem);
          }

          // We're guessing that these elements are the same, equate their signatures
          // So that when we compare visuals, we think we're comparing the same thing
          match.elem._sig = elem._sig;
          imbalancesB.splice(imbalancesB.indexOf(match.elem), 1);
        }
        else {
          this._difference("removed", elem, undefined);
          this.excludeCompletely.push(elem);
        }
      }
      for(i = 0; i < imbalancesB.length; i ++) {
        this._difference("added", undefined, imbalancesB[i]);
        this.excludeCompletely.push(elem);
      }
    },

    /**
     * Attempt to find a corresponding element of elemA in the list of imbalanced
     * elements in the B tree (sigsB). If we find a perfect match we immediately
     * break. If we fail to, but have come across a similar element (one which
     * has the same first child, but has a different attribute or tag name),
     * we also mark this as a match after searching all other possibles. If we
     * fail to find a match, we return null.
     * @param  {Element} elemA - The element to find a match for
     * @param  {Array} sigsB - The list of imbalanced elements
     * @return {Object} - A match object containing the matching element and
     *                    the type of match.
     */
    _findMatch: function(elemA, elemsB) {
      var matches = [],
          foundIdentical = false,
          match, i, elemB, tagSame, attrsSame, textSame;

      for(i = 0; i < elemsB.length; i ++) {
        elemB = elemsB[i];
        tagSame = elemA.tagName === elemB.tagName;
        attrsSame = elemA._attrStr === elemB._attrStr;
        textSame = elemA._textStr === elemB._textStr;

        if(tagSame + attrsSame + textSame >= 2) {
          match = { elem: elemB };

          if(tagSame && attrsSame && textSame) {
            match.type = "identical";
            foundIdentical = true;
          }
          else {
            if(!tagSame) {
              match.type = "tag";
            }
            if(!attrsSame) {
              match.type = "attr";
            }
            if(!textSame) {
              match.type = "text";
            }
          }

          matches.push(match);
        }
      }

      // If we've found any identical elements, filter out all worse matches
      if(foundIdentical) {
        matches = matches.filter(function(match) {
          return match.type == "identical";
        });
      }

      // Return the element who's index is closest to the originals
      if(matches.length > 0) {
        return matches.sort(function(b1, b2) {
          var diffB1 = Math.abs(b1.elem._index - elemA._index),
              diffB2 = Math.abs(b2.elem._index - elemA._index);

          if(diffB1 < diffB2) return -1;
          else if(diffB2 < diffB1) return 1;
          return 0;
        })[0];
      }

      return null;
    },

    /**
     * Find visual changes
     */
    findVisualDifferences: function(async) {
      var i = 0, indexA = 0, indexB = 0,
          typeA, typeB, differences, previousReport, types, forwardA, forwardB;

      if(async === undefined) {
        async = {
          a: traverse.forward({
            stop: this.a,
            all: true,
            exclude: this.excludeCompletely
          }),
          b: traverse.forward({
            stop: this.b,
            all: true,
            exclude: this.excludeCompletely
          }),
          calls: 0,
          progress: 0,
        };
      }

      async.calls ++;

      while(async.a !== null && async.b !== null && i < 15) {
        typeA = DOM.isNode(async.a) && DOM.nodeType(async.a);
        typeB = DOM.isNode(async.b) && DOM.nodeType(async.b);
        types = [typeA, typeB].sort();
        forwardA = forwardB = true;

        if(typeA == "element") indexA = async.a._index;
        if(typeB == "element") indexB = async.b._index;

        if(typeA !== typeB) {

          // A text node has been added / removed
          if(types[0] == "element" && types[1] == "text") {
            if(typeA == "element") {
              forwardA = false;
            }
            else {
              forwardB = false;
            }

            /*if(sameIgnoringSpaces(nextA, nextB) &&
              textVisuallyDifferent(nextA, nextB)) {
              this._difference("space", nextA, nextB);
            }*/
          }

          // We're comparing an element/text to something unknown, skip the unknown
          else if(types.indexOf("element") != -1 || types.indexOf("text") != -1) {
            if(typeA == "element" || typeA == "text") {
              forwardA = false;
            }
            else {
              forwardB = false;
            }
          }
        }
        else {

          // Compare visual differences
          if(typeA == "element") {
            differences = visual.elemsDiffer(async.a, async.b);

            if(differences !== null) {
              previousReport = this.alreadyReportedStyleChange(async.a, differences);

              // If we've never seen this difference before, report it
              if(previousReport === null) {
                async.a._styleAffects = 1;
                async.a._styleDiff = differences;
                this._difference("style", async.a, async.b);
              }

              // If we have, increment the number of elements affected by it
              else {
                previousReport._styleAffects ++;
              }
            }
          }

          // Compare text differences including spaces if important
          // If the nodes are not identical, but when you factor out space
          // changes they are, we check if those space changes matter
          else if(typeA == "text" && async.a.nodeValue !== async.b.nodeValue &&
                  DOM.sameIgnoringSpaces(async.a, async.b) &&
                  visual.textsDiffer(async.a, async.b)) {
            this._difference("space", async.a, async.b);
          }
        }

        if(forwardA) {
          async.a = traverse.forward({
            last: async.a,
            stop: this.a,
            all: true,
            exclude: this.excludeCompletely
          });
        }
        if(forwardB) {
          async.b = traverse.forward({
            last: async.b,
            stop: this.b,
            all: true,
            exclude: this.excludeCompletely
          });
        }
        i ++;
      }

      if(async.a === null || async.b === null) {
        async.progress = 100;
      }

      else if(indexA && indexB) {
        async.progress = Math.round(50 * ((indexA / this.totalA) + 
                                          (indexB / this.totalB)));
        async.progress = Math.min(99, async.progress);
      }

      return async;
    },

    /**
     * Loop through the existing reports of style changes. If both the signatures
     * and the changes match up, then count them as similar changes, and increment
     * the number of elements affected for the given change
     * @param  {Element} elem
     * @param  {Object} differences
     * @return {Element|null} - The first element to report the change, or null
     */
    alreadyReportedStyleChange: function(elem, differences) {
      var styleDifferences = this.differences.style,
          count = styleDifferences.length, i, comparison;

      for(i = 0; i < count; i ++) {
        comparison = styleDifferences[i][0];
        if(elem._tagSig === comparison._tagSig &&
           JSON.stringify(differences) === JSON.stringify(comparison._styleDiff)) {
          return comparison;
        }
      }

      return null;
    },

    /**
     * Log an error
     * @param {string} type - The type of error reported
     * @param {Node} [nodeA]
     * @param {Node} [nodeB]
     */
    _difference: function(type, elemA, elemB) {
      this.differenceCount ++;
      this.differences[type].push([elemA, elemB]);

      if(elemA !== undefined) elemA._difference = type;
      if(elemB !== undefined) elemB._difference = type;

      if(this.differenceCount >= this.MAX_DIFFERENCES) {
        this.stoppedAtMax = true;
        throw new exceptions.LimitError("Max number of differences reached");
      }
    }
  };

  return Compare;

});
