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

  var DEBUGGING = false,
      log = window.console.log.bind(window.console);

  if(!DEBUGGING) {
    log = function() {};
  }

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

    this.parse_exclusions();
    this.signatureMap = {};

    try {
      this._parse_elements();
      this._process_imbalances();
      this._find_movements();
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
    parse_exclusions: function() {
      var length, i, exclude, attrs, attr;

      this.exclude_completely = [];
      this.exclude_changes = [];

      if(this.opts.exclude instanceof Array) {
        length = this.opts.exclude.length;

        exclusions:
        for(i = 0; i < length; i++) {
          exclude = this.opts.exclude[i];

          if(typeof exclude.tag === "string" || exclude.attributes instanceof Array) {
            if(typeof exclude.tag === "string") exclude.tag = exclude.tag.toUpperCase();
            if(!exclude.hasOwnProperty("method") || exclude.method === "all") {
              this.exclude_completely.push(exclude);
            }
            else {
              attrs = exclude.method.attr;
              if(typeof attrs == "object") {
                for(attr in attrs) {
                  if(attrs[attr] !== "*") {
                    try {
                      attrs[attr] = new RegExp(attrs[attr], "i");
                    }
                    catch(e) {
                      throw new SyntaxError("Failed to parse exception RegExp: " + attrs[attr]);
                    }
                  }
                }
              }
              this.exclude_changes.push(exclude);
            }
          }
        }
      }
    },

    /**
     * Parse the trees and create a map of element signatures -> elements in A and B
     */
    _parse_elements: function() {
      var list, next, i, signature;

      ["a", "b"].forEach(function(tree) {
        i = 0;
        list = this["elems" + tree.toUpperCase()] = [];
        next = traverse.forward({
          stop: this[tree],
          exclude: this.exclude_completely
        });

        while(next) {
          signature = DOM.signature(next);
          this.add_to_map(next, tree);
          list.push(next);
          next._index = i;
          next = traverse.forward({
            last: next,
            stop: this[tree],
            exclude: this.exclude_completely
          });
          i ++;
        }

        this["total" + tree.toUpperCase()] = i;
      }, this);
    },

    /**
     * Find elements which have moved by traversing both node lists
     */
    _find_movements: function() {
      var missingA = {}, missingB = {},
          indexA = 0, indexB = 0,
          nextA, nextB, sigA, sigB;

      while(true) {
        nextA = this.elemsA[indexA];
        nextB = this.elemsB[indexB];

        if(!nextA && !nextB) break;

        sigA = nextA ? nextA._sig : "";
        sigB = nextB ? nextB._sig : "";

        if(sigA == sigB) {
          indexA ++;
          indexB ++;
        }

        else {
          if((sigA in missingA) || (sigB in missingB)) {
            if(sigA in missingA) {
              this._difference("moved", nextA, missingA[sigA]);
              delete missingA[sigA];
              indexA ++;
            }

            if(sigB in missingB) {
              this._difference("moved", missingB[sigB], nextB);
              delete missingB[sigB];
              indexB ++;
            }
          }
          else {
            missingA[sigB] = nextB;
            missingB[sigA] = nextA;
            indexA ++;
            indexB ++;
          }
        }
      }
    },

    /**
     * Add an element to the element map
     */
    add_to_map: function(elem, source) {
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
    _process_imbalances: function() {
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
        match = this._find_match(elem, imbalancesB);
        if(match) {

          // Report all non-exact matches
          if(["attr", "tag", "text"].indexOf(match.type) !== -1) {
            if(this.should_report_change(elem, match)) {
              this._difference(match.type, elem, match.elem);
            }
          }

          // We're guessing that these elements are the same, equate their signatures
          // So that when we compare visuals, we think we're comparing the same thing
          match.elem._sig = elem._sig;
          imbalancesB.splice(imbalancesB.indexOf(match.elem), 1);
        }
        else {
          this._difference("removed", elem);
        }
      }
      for(i = 0; i < imbalancesB.length; i ++) {
        this._difference("added", imbalancesB[i]);
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
     * @return {[type]}       [description]
     */
    _find_match: function(elemA, elemsB) {
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
     * Decide whether we should report a text/attribute/tag change given the
     * list of exclusions set
     */
    should_report_change: function(elem, match) {
      var rule = traverse.onExclusionList(elem, this.exclude_changes);

      // If we can't find a rule for the element, or it's change isn't excluded
      if(!rule || !rule.method.hasOwnProperty(match.type)) return true;

      // If we're permitted to change attributes, check that only those ones have
      if(match.type == "attr") {
        return !this.attr_changes_match(elem, match.elem, rule.method.attr);
      }
    },

    attr_changes_match: function(elemA, elemB, exclude) {
      var checked = [],
          length = elemA.attributes.length,
          attr, i, attrA, attrB, exclusion, strippedA, strippedB;

      // Check that each A attribute is either equal to B or is excluded
      for(i = 0; i < length; i++) {
        attr = elemA.attributes[i].name;
        attrA = elemA.getAttribute(attr);
        attrB = elemB.getAttribute(attr);
        checked.push(attr);

        // We've got an attibute change
        if(attrA !== attrB) {
          exclusion = exclude[attr];

          // It's not on our exclusion list
          if(exclusion === undefined) {
            return false;
          }

          // It's on our exclusion list, but the exclusion is a regex, and
          // when we remove the matched groups, they're still not equal
          else if(exclusion instanceof RegExp) {
            strippedA = regexp.removeMatchGroups(attrA, exclusion);
            strippedB = regexp.removeMatchGroups(attrB, exclusion);

            if(strippedA !== strippedB) {
              return false;
            }
          }
        }
      }

      length = elemB.attributes.length;

      // Check that any added B attributes are excluded
      for(i = 0; i < length; i++) {
        attr = elemB.attributes[i].name;
        if(checked.indexOf(attr) == -1 && exclude.indexOf(attr) == -1) {
          return false;
        }
      }

      return true;
    },

    /**
     * Find visual changes
     */
    find_visual_differences: function(nextA, nextB) {
      var that = this,
          i = 0, 
          indexA = 0, indexB = 0,
          progress,
          typeA, typeB, differences, previousReport, types, forwardA, forwardB;

      if(nextA === undefined) {
        nextA = traverse.forward({
          stop: this.a,
          all: true,
          exclude: this.exclude_completely
        });
        nextB = traverse.forward({
          stop: this.b,
          all: true,
          exclude: this.exclude_completely
        });
      }

      while(nextA !== null && nextB !== null && i < 25) {
        typeA = nextA && DOM.nodeType(nextA);
        typeB = nextB && DOM.nodeType(nextB);
        types = [typeA, typeB].sort();
        forwardA = forwardB = true;

        if(typeA == "element") indexA = nextA._index;
        if(typeB == "element") indexB = nextB._index;

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
            differences = visual.elemsDiffer(nextA, nextB);

            if(differences !== null) {
              previousReport = that.already_reported_style_change(nextA, differences);

              // If we've never seen this difference before, report it
              if(previousReport === null) {
                nextA._styleAffects = 1;
                nextA._styleDiff = differences;
                that._difference("style", nextA, nextB);
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
          else if(typeA == "text" && nextA.nodeValue !== nextB.nodeValue &&
                  DOM.sameIgnoringSpaces(nextA, nextB) &&
                  visual.textsDiffer(nextA, nextB)) {
            that._difference("space", nextA, nextB);
          }
        }

        if(forwardA) {
          nextA = traverse.forward({
            last: nextA,
            stop: that.a,
            all: true,
            exclude: that.exclude_completely
          });
        }
        if(forwardB) {
          nextB = traverse.forward({
            last: nextB,
            stop: that.b,
            all: true,
            exclude: that.exclude_completely
          });
        }
        i ++;
      }

      if(nextA || nextB) {
        progress = Math.round(((indexA / that.totalA) + (indexB / that.totalB)) * 50);
        progress = Math.min(99, progress);
      }
      else {
        progress = 100;
      }
      return {
        a: nextA,
        b: nextB,
        progress: progress
      };
    },

    /**
     * Loop through the existing reports of style changes. If both the signatures
     * and the changes match up, then count them as similar changes, and increment
     * the number of elements affected for the given change
     * @param  {Element} elem
     * @param  {Object} differences
     * @return {Element|null} - The first element to report the change, or null
     */
    already_reported_style_change: function(elem, differences) {
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
     * @param {Node} nodeA
     * @param {Node} nodeB
     */
    _difference: function(type, elemA, elemB) {
      this.differenceCount ++;
      this.differences[type].push([elemA, elemB]);

      if(this.differenceCount >= this.MAX_DIFFERENCES) {
        this.stopped_at_max = true;
        throw new exceptions.LimitError("Max number of differences reached");
      }
    }
  };

  return Compare;

});
