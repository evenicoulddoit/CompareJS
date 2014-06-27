/* =============================================================================
 * Compare.js
 * =============================================================================
 * Compares two different DOM trees, for element & differences
 * ===========================================================================*/

(function(window, log) { "use strict";

  var LEFT_WHITESPACE_REGEX  = /^\s+/,
      RIGHT_WHITESPACE_REGEX = /\s+$/,
      MULTI_SPACE_REGEX = /\s{2,}/g,
      DEBUGGING = false;

  if(!DEBUGGING) {
    log = function() {};
  }

  /**
   * Check whether a given node is an element and has a block context
   * @param  {Node} node
   * @return {Boolean}
   */
  function hasBlockContext(node) {
    var displays = ["inline", "inline-block"], style;

    if(!(node instanceof window.Element)) return false;

    style = window.getComputedStyle(node);
    return (style.getPropertyValue("float") != "none" ||
            displays.indexOf(style.getPropertyValue("display")) == -1);
  }

  /**
   * Given an element, calculate if the space around it matters.
   * For block elements, it won't, for others, it might.
   * @param {Node} node
   */
  function spaceMatters(node, differences) {

    // Direct block element
    if(!node.previousSibling && !node.nextSibling && hasBlockContext(node.parentNode)) {
      return false;
    }

    // If important in any direction, 
    if(differences.indexOf("left") != -1 && spaceImportant(node, goBack)) {
      return true;
    }
    if(differences.indexOf("right") != -1 && spaceImportant(node, goForward)) {
      return true;
    }

    return false;
  }

  function spaceImportant(node, nextFn) {
    var previous = node;
    while(true) {
      previous = nextFn(previous, null, true);

      // Before reaching a block-level element, we've come across a
      // space-less text node
      if((previous instanceof window.Text)) {
        if(previous.nodeValue.match(LEFT_WHITESPACE_REGEX) === null) {
          return true;
        }
        else {
          break;
        }
      }

      // Reached a block-level element, spaces won't matter
      if(hasBlockContext(previous)) {
        break;
      }
    }
    return false;
  }

  /**
   * 
   */
  function goBack(last, stop, any) {
    var prev;
    if(!last) return getLastChild(stop);
    if(last.children.length) return getLastChild(last);

    prev = getPrev(last);
    if(prev) return prev;
    if(last.parentNode == stop) return null;
    return getPrev(last.parentNode);
  }

  /**
   * Get the next node given the previous. Stop if we bubble back up to the initial parent.
   * We first look down, then along, then up.
   * @param {Node} [last] - If undefined, returns stop's firstChild
   * @param {Node} stop
   * @returns {Node|null}
   * @memberof Compare
   */
  function goForward(last, stop) {
    if(!last) return getFirstChild(stop);

    // Down
    if(last.children.length) return getFirstChild(last);

    // Along
    if(last.nextElementSibling) return last.nextElementSibling;

    // Up
    while(last != stop) {
      last = last.parentNode;
      if(last == stop) return null;
      if(last.nextElementSibling) return last.nextElementSibling;
    }
  }

  function getFirstChild(from) {
    if(from.children.length) {
      return from.children[0];
    }
    return null;
  }

  function getLastChild(from) {
    if(from.children.length) {
      return from.children[from.children.length-1];
    }
    return null;
  }

  function nodeType(node) {
    return {
      1: "element",
      3: "text"
    }[node.nodeType.toString()];
  }

  /**
   * With a given element, produce a string descibing it's type and attribute
   * @param  {Element} elem
   * @return {string}
   */
  function elemSignature(elem) {
    var tagName = elem.tagName.toLowerCase(),
        attrStr = getAttrStr(elem),
        textStr = getTextStr(elem);

    elem._sig = elem._originalSig = "<" + tagName + attrStr + ">" +
                                    textStr + "</" + tagName + ">";

    elem._attrStr = attrStr;
    elem._textStr = textStr;

    return elem._sig;
  }

  function getAttrStr(elem) {
    var length = elem.attributes.length,
        attrKeys = [],
        attrStr = "", attr, i;

    for(i = 0; i < length; i++) {
      attrKeys.push(elem.attributes[i].name);
    }

    attrKeys.sort();

    for(i = 0; i < length; i++) {
      attr = attrKeys[i];
      attrStr += " " + attr + "=\"" + elem.attributes.getNamedItem(attr).value + "\"";
    }

    return attrStr;
  }

  function getTextStr(elem) {
    var length = elem.childNodes.length,
        nodes = [], node, i;

    for(i = 0; i < length; i++) {
      node = elem.childNodes[i];
      if(nodeType(node) == "text") {
        nodes.push(node.nodeValue);
      }
    }

    return nodes.join(" ").replace(MULTI_SPACE_REGEX, " ").trim();
  }

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

  /**
   * @constructor
   * @param {Element} a
   * @param {Element} b
   */
  function Compare(a, b) {
    this.a = a;
    this.b = b;

    this.differences = {
      elements: {
        retag: [],
        reattribute: [],
        removed: [],
        added: [],
        text: [],
        moved: []
      },
      visual: {}
    };

    log("Loading...", this.a, this.b);
    this.signatureMap = {};
    this._parse_elements();
    this._process_imbalances();
    this._find_movements();
    log("Done loading", a, b);
  }

  Compare.prototype = {

    /**
     * Parse the trees and map a map of element signatures -> elements in A and B
     */
    _parse_elements: function() {
      var nextA = goForward(this.a, this.a),
          nextB = goForward(this.b, this.b);

      this.elemsA = [];

      while(nextA) {
        this.add_to_map(nextA, "a");
        this.elemsA.push(nextA);
        nextA = goForward(nextA, this.a);
      }

      this.elemsB = [];

      while(nextB) {
        this.add_to_map(nextB, "b");
        this.elemsB.push(nextB);
        nextB = goForward(nextB, this.b);
      }
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
        log(nextA, nextB);

        if(!nextA && !nextB) break;

        sigA = nextA ? nextA._sig : "";
        sigB = nextB ? nextB._sig : "";

        if(sigA == sigB) {
          log("    Identical");
          indexA ++;
          indexB ++;
        }

        else {
          if((sigA in missingA) || (sigB in missingB)) {
            if(sigA in missingA) {
              this._difference("elements", "moved", nextA, missingA[sigA]);
              delete missingA[sigA];
              indexA ++;
            }

            if(sigB in missingB) {
              this._difference("elements", "moved", missingB[sigB], nextB);
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
      var signature = elemSignature(elem);
      if(!(signature in this.signatureMap)) this.signatureMap[signature] = new MapList();
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
          removeCount = 0,
          signature, elems, elem, i,  match;

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
        match = this._find_match(elem, imbalancesB, (i - removeCount));
        if(match) {
          if(match.type === "attr") {
            this._difference("elements", "reattribute", elem, match.elem);
          }

          else if(match.type === "tag") {
            this._difference("elements", "retag", elem, match.elem);
          }

          else if(match.type === "text") {
            this._difference("elements", "text", elem, match.elem);
          }

          // We're guessing that these elements are the same, equate their signatures
          // So that when we compare visuals, we think we're comparing the same thing
          match.elem._sig = elem._sig;
          imbalancesB.splice(imbalancesB.indexOf(match.elem), 1);
          removeCount ++;
        }
        else {
          this._difference("elements", "removed", elem);
        }
      }
      for(i = 0; i < imbalancesB.length; i ++) {
        this._difference("elements", "added", imbalancesB[i]);
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
    _find_match: function(elemA, elemsB, originalIndex) {
      var matches = [],
          match, i, elemB, tagSame, attrsSame, textSame;

      for(i = 0; i < elemsB.length; i ++) {
        elemB = elemsB[i];
        tagSame = elemA.tagName === elemB.tagName;
        attrsSame = elemA._attrStr === elemB._attrStr;
        textSame = elemA._textStr === elemB._textStr;

        if(tagSame + attrsSame + textSame >= 2) {
          match = {
            i: i,
            elem: elemB
          };

          if(tagSame && attrsSame && textSame) {
            match.type = "identical";
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

      // If we've found multiple matches, return the match with the closest
      // index to the original
      console.log("Looking for matches for " + elemA, " - index " + originalIndex);
      console.log("    ", matches);
      if(matches.length > 0) {
        return matches.sort(function(a, b) {
          var diffA = Math.abs(a.i - originalIndex),
              diffB = Math.abs(b.i - originalIndex);

          if(diffA < diffB) return -1;
          else if(diffB < diffA) return 1;
          return 0;
        })[0];
      }

      return null;
    },

    /**
     * Calculate whether space to the left and right differs between textNodes
     * @param {string} valueA - The text of node A
     * @param {string} valueB - The text of node B
     * @returns {Boolean} Whether both left and right are identical
     */
    _different_spaces: function(valueA, valueB) {
      var aLeft  = valueA.match(LEFT_WHITESPACE_REGEX)  === null,
          bLeft  = valueB.match(LEFT_WHITESPACE_REGEX)  === null,
          aRight = valueA.match(RIGHT_WHITESPACE_REGEX) === null,
          bRight = valueB.match(RIGHT_WHITESPACE_REGEX) === null,
          differences = [];

      if(aLeft != bLeft) differences.push("left");
      if(aRight != bRight) differences.push("right");

      return differences;
    },

    /**
     * Log an error
     * @param {string} type - The type of error reported
     * @param {Node} nodeA
     * @param {Node} nodeB
     */
    _difference: function(category, type, elemA, elemB) {
      log(arguments);
      if(elemB) {
        this.differences[category][type].push([elemA, elemB]);
      }
      else {
        this.differences[category][type].push([elemA, elemB]);
      }
    }
  };

  window.Compare = Compare;

})(window, window.console.log.bind(window.console));
