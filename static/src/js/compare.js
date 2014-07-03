/* =============================================================================
 * Compare.js
 * =============================================================================
 * Compares two different DOM trees, for element & differences
 * ===========================================================================*/

(function(window, specificity, log) { "use strict";

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

  function sameIgnoringSpaces(nodeA, nodeB) {
    return (nodeA.nodeValue.replace(MULTI_SPACE_REGEX, "") ===
            nodeB.nodeValue.replace(MULTI_SPACE_REGEX, ""));
  }

  /**
   * Given at least one text node, check if space changes matter
   * @param  {Text} [nodeA]
   * @param  {Text} [nodeB]
   * @return {Boolean}
   */
  function textVisuallyDifferent(nodeA, nodeB) {
    var compareNode = nodeA || nodeB,
        nodeWindow = compareNode.ownerDocument.parent
        parentStyle = window.getComputedStyle(compareNode.parentNode),
        parentBlock = parentStyle.getPropertyValue("display") === "block",
        parentFloat = parentStyle.getPropertyValue("float") !== "none",
        parentSpaceMatters = parentBlock || parentFloat,
        textA = nodeA !== null ? nodeA.nodeValue : "",
        textB = nodeB !== null ? nodeB.nodeValue : "",
        back, forward;

    return false;
        /*if()

        while(back !== this.a) {
          back = goBack(nodeA, this.a, true);
          if(back )

        }

        while(forward !== this.a) {

        }

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
      */
  }

  function _startsWith(a) {
    return function(b) {
      return b.indexOf(a) === 0;
    };
  }

  function startsWith(a, b) {
    return a.indexOf(b) === 0;
  }

  /**
   * Compare two elements and determine whether they are stylistically different
   * We first check their computed style, to get a concrete answer. If we find
   * any, we then try to calculate why they've changed, by finding all CSS rule
   * changes between the two elements. Finally we collect all style changes
   * which have had an affect on the computed values, and report them. This
   * allows us to filter out all erroneous information, such as a parent's
   * width changing a child's, and reporting on both.
   * @param  {Element} elemA
   * @param  {Element} elemB
   * @return {Boolean} Whether these two elements styles differ.
   */
  function elementStylesDiffer(elemA, elemB) {
    var computedDifferences = styleComputedDifferences(elemA, elemB),
        sharedDifferences = { a: {}, b: {} },
        sharedCount = 0,
        ruleDifferences, difference;

    if(computedDifferences.length) {
      ruleDifferences = styleRuleDifference(elemA, elemB);
      for(difference in ruleDifferences) {
        if(computedDifferences.filter(_startsWith(difference)).length > 0) {
          if(ruleDifferences[difference][0] !== undefined) {
            sharedDifferences.a[difference] = ruleDifferences[difference][0];
          }
          if(ruleDifferences[difference][1] !== undefined) {
            sharedDifferences.b[difference] = ruleDifferences[difference][1];
          }
          sharedCount ++;
        }
      }
    }

    shorthandMarginPadding(sharedDifferences);

    //console.log(sharedDifferences);
    //shorthandStyleDifferences(sharedDifferences);
    //   

    return sharedCount !== 0 ? sharedDifferences: null;
  }

  /**
   * Find the computed style differences between two elements
   * @param  {Element} elemA 
   * @param  {Element} elemB
   * @return {Array} - An array of property names
   */
  function styleComputedDifferences(elemA, elemB) {
    var stylesA = window.getComputedStyle(elemA),
        stylesB = window.getComputedStyle(elemB),
        differences = [],
        count = stylesA.length, rule, i;

    // Go through all of A and check equal
    for(i = 0; i < count; i ++) {
      rule = stylesA[i];

      if(stylesA.getPropertyValue(rule) != stylesB.getPropertyValue(rule)) {
        differences.push(rule);
      }
    }

    return differences;
  }

  /**
   * Firefox prefixes -value onto some properties for an unknown reason.
   * Wherever we find this, remove it, so that the output is nice
   * @param  {string} styleName
   * @return {string}
   */
  function uniformName(styleName) {
    var pos = styleName.indexOf("-value");
    if(pos !== -1 && pos === styleName.length - 6) {
      styleName = styleName.substring(0, pos);
    }
    return styleName;
  }

  /**
   * Find the stylesheet rule differences between elements
   * @param  {Element} elemA
   * @param  {Element} elemB
   * @return {Object} - An object of property name -> property value pairs
   */
  function styleRuleDifference(elemA, elemB) {
    var stylesA = findRulesFor(elemA),
        stylesB = findRulesFor(elemB),
        differences = {},
        checked = [],
        styleName, styleB;

    for(styleName in stylesA) {
      styleB = (stylesB[styleName] || {}).value;
      if(stylesA[styleName].value != styleB) {
        differences[styleName] = [stylesA[styleName].value, styleB];
      }
      checked.push(styleName);
    }

    for(styleName in stylesB) {
      if(checked.indexOf(styleName) == -1) {
        differences[styleName] = [undefined, stylesB[styleName].value];
      }
    }

    return differences;
  }

  function elementMatches(element, selector) {
    var i, match,
        matches = ["matches", "webkitMatchesSelector", 
                   "mozMatchesSelector", "msMatchesSelector"];

    for(i = 0; i < matches.length; i++) {
      match = matches[i];
      if(match in element) {
        return element[match](selector);
      }
    }
  }

  function findRulesFor(element) {
    var styles = {},
        sheets = element.ownerDocument.styleSheets,
        sheet, rules, rule, selectors, selector, specs, spec, i, j, k;

    // Loop through every locally hosted sheet
    for(i = 0; i < sheets.length; i++) {
      sheet = sheets[i];
      rules = sheet.cssRules;
      if(!rules) continue;

      // Loop through all the rules within the sheet
      for(j = 0; j < rules.length; j++) {
        rule = rules[j];
        selectors = rule.selectorText.split(",");
        specs = [];

        // Loop through all selectors for the rule
        for(k = 0; k < selectors.length; k++) {
          selector = selectors[i];

          // If the selector matches this element, store its specificity value
          if(elementMatches(element, selector)) {
            specs.push(specificity(selector));
          }
        }

        // If anything matched, pull off the most specific and add all
        // specificity-beating rules
        if(specs.length) {
          spec = Math.max.apply(Math, specs);
          specificityAdd(spec, styles, rule.style);
        }
      }
    }

    return styles;
  }

  /**
   * Edit an object of rules mappings in-place, replacing items where the
   * specificity of the selector is at least as high as the existing
   * @param  {Number} spec - The specificty value for these new rules
   * @param  {Object} existingStyles - The existing rules
   * @param  {Object} newStyles - The new rules to conditionally add
   */
  function specificityAdd(spec, existingStyles, newStyles) {
    var length = newStyles.length,
        styleOrig, styleName, i;

    for(i = 0; i < length; i++) {
      styleOrig = newStyles[i];
      styleName = uniformName(styleOrig);

      if(!(styleName in existingStyles && spec < existingStyles[styleName].specificity)) {
        existingStyles[styleName] = {
          specificity: spec,
          value: newStyles.getPropertyValue(styleOrig)
        };
      }
    }
  }

  /*var DIRECTIONS = ["top", "right", "bottom", "left"],
      SHORTHANDABLE = {
        "margin": {
          directions: true
        },
        "padding": {
          directions: true
        },
        "border": {
          directions: true,
          properties: ["width", "style", "color"]
        },
        "background": {
          properties: ["image", "position", "size", "repeat", "origin", "style",
                       "clip", "color"]
        },
        "list-style": {
          properties: ["type", "position", "image"]
        }
      };*/

  function equalValues(obj, keys) {
    var length = keys.length,
        value, i;

    for(i = 0; i < length; i++) {
      if(i === 0) value = obj[keys[i]];
      else if(obj[keys[i]] !== value) return false;
    }

    return true;
  }

  function removeKeys(obj, keys) {
    var length = keys.length, i;
    for(i = 0; i < length; i++) {
      delete obj[keys[i]];
    }
  }

  function shorthandMarginPadding(differences) {
    var diffTree, removeOriginals, keys;

    ["a", "b"].forEach(function(tree) {
      ["margin", "padding"].forEach(function(rule) {
        diffTree = differences[tree];
        removeOriginals = false;
        keys = Object.keys(diffTree).filter(function(key) {
          return key.indexOf(rule + "-") === 0;
        });

        // We can only shorthand if all values are set
        if(keys.length == 4) {

          // All values identical
          if(equalValues(diffTree, keys)) {
            removeOriginals = true;
            diffTree[rule] = diffTree[keys[0]];
          }

          // Equal left and values, required at least for a shorthand
          else if(equalValues(diffTree, [rule + "-left", rule + "-right"])) {
            removeOriginals = true;

            // Equal x's and equal y's
            if(equalValues(diffTree, [rule + "-top", rule + "-bottom"])) {
              diffTree[rule] = diffTree[rule + "-top"] + " " +
                               diffTree[rule + "-left"];
            }

            // Equal x's different top and bottom
            else {
              diffTree[rule] = diffTree[rule + "-top"] + " " +
                               diffTree[rule + "-left"] + " " +
                               diffTree[rule + "-bottom"];

            }
          }

          if(removeOriginals) {
            removeKeys(diffTree, [
              rule + "-top", rule + "-right", rule + "-bottom", rule + "-left"
            ]);
          }
        }
      });
    });
  }

  /*
  function allSame() {

  }

  function allPresent(findRegex, differences, index) {
    var keys, length, i;

    keys = Object.keys(differences).filter(function(key) {
      return key.match(findRegex) !== null;
    });

    for(i = 0; i < length; i ++) {
      if(differences[keys[i]][index] === undefined) return false;
    }

    return true;
  }

  /**
   * Convert a series of long-hand CSS rules, into their short-hand equivalents
   * @param  {Object} differences
   * @return {Object} - The sorted differences
   /
  function shorthandStyleDifferences(differences) {
    var convertedA = {},
        convertedB = {},
        shorted = {},
        i = 0,
        splits, propertyName, styleA, styleB, rule;

    for(rule in differences) {
      splits = rule.split("-");
      propertyName = splits[0];
      styleA = differences[rule][0];
      styleB = differences[rule][1];

      // Ignore vendor prefixes
      if(!startsWith(rule, "-") && SHORTHANDABLE.hasOwnProperty(propertyName)) {
        i ++;
        if(styleA !== undefined) shorthandMap(propertyName, splits, styleA, convertedA);
        if(styleB !== undefined) shorthandMap(propertyName, splits, styleB, convertedB);
        // delete differences[rule]
      }
    }

    convertToShorthand(convertedA);
    convertToShorthand(convertedB);

    if(i) {
      console.log(convertedA, convertedB);
    }

    /*for(rule in convertedA) {
      if(SHORTHANDABLE[rule].directions === true) {
        if(styleDirectionsEqual(convertedA[rule])) {

          // Just take one of the directions as the one for all
        }
        else {
          // Loop through and combine for each
        }
        console.log(rule, styleDirectionsEqual(convertedA[rule]));
      }
      else {

      }
    }

    for(rule in convertedB) {
      if(SHORTHANDABLE[rule].directions === true) {
        console.log(rule, styleDirectionsEqual(convertedB[rule]));
      }
    }/
  }

  function shorthandMap(property, splits, value, obj) {
    var attributes = SHORTHANDABLE[property], rule;

    if(attributes.hasOwnProperty("properties")) {
      property = splits.pop();
      rule = splits.join("-");
      if(!(obj.hasOwnProperty(rule))) {
        obj[rule] = new Array(attributes.properties.length);
      }
      obj[rule][attributes.properties.indexOf(property)] = value;
      splits.push(property);
    }
    else {
      obj[splits.join("-")] = value;
    }
  }

  function convertToShorthand(styles) {
    //var style;
    //for()
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
    var back;

    if(!last) return goBack(stop, stop, any);

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
  }

  /**
   * Get the next node given the previous. Stop if we bubble back up to the initial parent.
   * We first look down, then along, then up.
   * @param {Node} [last] - If undefined, returns stop's firstChild
   * @param {Node} stop
   * @returns {Node|null}
   * @memberof Compare
   */
  function goForward(last, stop, any) {
    var forward;

    if(!last) return goForward(stop, stop, any);

    // Down
    forward = getFirstChild(last, any);
    if(forward) return forward;

    // Along
    forward = nextElement(last, any);
    if(forward) return forward;

    // Up
    while(last != stop) {
      last = last.parentNode;
      if(last == stop) return null;

      forward = nextElement(last, any);
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
   * Define a custom error, to throw when we reach our difference limit
   * @param {string} message
   */
  function LimitError(message) {
    this.name = "ReachedLimitError";
    this.message = message;
    this.stack = (new Error()).stack;
  }

  LimitError.prototype = Object.create(Error.prototype);

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
  function Compare(opts) {
    if(!opts.a || !opts.b) {
      throw new TypeError("You must supply both DOM tree A and B");
    }

    this.a = opts.a;
    this.b = opts.b;

    this.MAX_DIFFERENCES = opts.max_differences || 25;

    this.aStyleSheets = this.a.ownerDocument.styleSheets;
    this.bStyleSheets = this.b.ownerDocument.styleSheets;

    this.differenceCount = 0;
    this.differences = {
      retag: [],
      reattribute: [],
      removed: [],
      added: [],
      text: [],
      moved: [],
      space: [],
      style: []
    };

    this.signatureMap = {};
    this._parse_elements();

    try {
      this._process_imbalances();
      this._find_movements();

      // We can only realistically compare visuals if nothing has been added,
      // removed, or moved
      if(this.differences.removed.length === 0 &&
         this.differences.added.length === 0 &&
         this.differences.moved.length === 0) {
        this.find_visual_differences();
      }
    }
    catch(e) {
      if(!(e instanceof LimitError)) {
        throw e;
      }
    }
  }

  Compare.prototype = {

    /**
     * Parse the trees and map a map of element signatures -> elements in A and B
     */
    _parse_elements: function() {
      var nextA = goForward(this.a, this.a),
          nextB = goForward(this.b, this.b),
          iA = 0, iB = 0;

      this.elemsA = [];

      while(nextA) {
        this.add_to_map(nextA, "a");
        nextA._index = iA;
        this.elemsA.push(nextA);
        nextA = goForward(nextA, this.a);
        iA ++;
      }

      this.elemsB = [];

      while(nextB) {
        this.add_to_map(nextB, "b");
        nextB._index = iB;
        this.elemsB.push(nextB);
        nextB = goForward(nextB, this.b);
        iB ++;
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
          if(match.type === "attr") {
            this._difference("reattribute", elem, match.elem);
          }

          else if(match.type === "tag") {
            this._difference("retag", elem, match.elem);
          }

          else if(match.type === "text") {
            this._difference("text", elem, match.elem);
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
     * Find visual changes
     */
    find_visual_differences: function() {
      var nextA = goForward(this.a, this.a, true),
          nextB = goForward(this.b, this.b, true),
          typeA, typeB, differences, previousReport, types;

      while(nextA !== null && nextB !== null) {
        typeA = nextA && nodeType(nextA);
        typeB = nextB && nodeType(nextB);
        types = [typeA, typeB].sort();

        if(typeA !== typeB) {

          // A text node has been added / removed
          if(types[0] == "element" && types[1] == "text") {
            if(typeA == "element") {
              nextB = goForward(nextB, this.b, true);
            }
            else {
              nextA = goForward(nextA, this.a, true);
            }

            /*if(sameIgnoringSpaces(nextA, nextB) &&
              textVisuallyDifferent(nextA, nextB)) {
              this._difference("space", nextA, nextB);
            }*/
          }

          // We're comparing an element/text to something unknown, skip the unknown
          else if(types.indexOf("element") != -1 || types.indexOf("text") != -1) {
            if(typeA == "element" || typeA == "text") {
              nextB = goForward(nextB, this.b, true);
            }
            else {
              nextA = goForward(nextA, this.a, true);
            }
          }

          // Comparing two unknowns, skip both
          else {
            nextA = goForward(nextA, this.a, true);
            nextB = goForward(nextB, this.b, true);
          }
        }
        else {

          // Compare visual differences
          if(typeA == "element") {
            differences = elementStylesDiffer(nextA, nextB);

            if(differences !== null) {
              previousReport = this.already_reported_style_change(nextA, differences);

              // If we've never seen this difference before, report it
              if(previousReport === null) {
                nextA._styleAffects = 1;
                nextA._styleDiff = differences;
                this._difference("style", nextA, nextB);
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
                  sameIgnoringSpaces(nextA, nextB) &&
                  textVisuallyDifferent(nextA, nextB)) {
            this._difference("space", nextA, nextB);
          }

          nextA = goForward(nextA, this.a, true);
          nextB = goForward(nextB, this.b, true);
        }
      }
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
        if(elem._sig === comparison._sig &&
           JSON.stringify(differences) === JSON.stringify(comparison._styleDiff)) {
          return comparison;
        }
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
    _difference: function(type, elemA, elemB) {
      this.differenceCount ++;
      this.differences[type].push([elemA, elemB]);

      if(this.differenceCount >= this.MAX_DIFFERENCES) {
        this.stopped_at_max = true;
        throw new LimitError("Max number of differences reached");
      }
    }
  };

  window.Compare = Compare;

})(window, window.specificity, window.console.log.bind(window.console));
