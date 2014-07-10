/* =============================================================================
 * Compare.js
 * =============================================================================
 * Compares two different DOM trees, for element & differences
 * ===========================================================================*/

(function(window, specificity, log) { "use strict";

  var LEFT_WHITESPACE_REGEX  = /^\s+/,
      RIGHT_WHITESPACE_REGEX = /\s+$/,
      MULTI_SPACE_REGEX = /\s{2,}/g,
      CSS_SELECTOR_REGEX = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/g,
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
   * Find the computed style differences between two elements. Ignore the domain
   * such that background images etc. don't return false-positives
   * @param  {Element} elemA 
   * @param  {Element} elemB
   * @return {Array} - An array of property names
   */
  function styleComputedDifferences(elemA, elemB) {
    var stylesA = window.getComputedStyle(elemA),
        stylesB = window.getComputedStyle(elemB),
        domainA = elemA.ownerDocument.URL.split("/").slice(0, 3).join("/"),
        domainB = elemB.ownerDocument.URL.split("/").slice(0, 3).join("/"),
        differences = [],
        count = stylesA.length, rule, i;

    // Go through all of A and check equal
    for(i = 0; i < count; i ++) {
      rule = stylesA[i];

      if(stylesA.getPropertyValue(rule).replace(domainA, "") != 
         stylesB.getPropertyValue(rule).replace(domainB, "")) {
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
        sheet, rules, rule, selectors, selector, length, specs, spec, i, j, k;

    // Loop through every locally hosted sheet
    for(i = 0; i < sheets.length; i++) {
      sheet = sheets[i];
      rules = sheet.cssRules;
      if(!rules) continue;

      // Loop through all the rules within the sheet
      for(j = 0; j < rules.length; j++) {
        rule = rules[j];

        if(rule.type === 1) {
          selectors = rule.selectorText.split(CSS_SELECTOR_REGEX).filter(notEmpty);

          length = selectors.length;
          specs = [];

          // Loop through all selectors for the rule
          for(k = 0; k < length; k++) {
            selector = selectors[k];

            // If the selector matches this element, store its specificity value
            try {
              if(elementMatches(element, selector)) {
                specs.push(specificity(selector));
                break;
              }
            }

            // If the selector is invalid, ignore it
            catch(e) {
              if(!(e instanceof SyntaxError)) {
                throw e;
              }
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
    }

    return styles;
  }

  /**
   * Check if a string contains anything other than whitespace
   * @param  {String} str
   * @return {Boolean}
   */
  function notEmpty(str) {
    return str.trim() !== ""; 
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
  function goForward(opts) {
    var forward;

    if(!opts.last) {
      opts.last = opts.stop;
      return goForward(opts);
    }

    forward = _goForward(opts);
    if(forward !== null && opts.exclude && onExclusionList(forward, opts.exclude)) {
      opts.no_down = true;
      opts.last = forward;
      return goForward(opts);
    }

    return forward;
  }

  function _goForward(opts) {
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
   * Return whether an element matches any of the provided list of exclusions
   * @param  {Element} elem
   * @param  {Array} list - The list of exclusion objecta
   * @return {Object|Boolean} - Either the exclusion rule or false
   */
  function onExclusionList(elem, list) {
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
        textStr = getTextStr(elem),
        tagSig = "<" + tagName + attrStr + ">";

    elem._sig = elem._originalSig = tagSig + textStr + "</" + tagName + ">";

    elem._tagSig = tagSig;
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

  function removeMatchGroups(str, re) {
    var exec = re.exec(str),
        length, i;

    if(exec === null) return str;
    exec.shift();

    length = exec.length;
    for(i = 0; i < length; i++) {
      str = str.replace(exec[i], "");
    }

    return str;
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
      if(!(e instanceof LimitError)) {
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
        next = goForward({ stop: this[tree], exclude: this.exclude_completely });

        while(next) {
          signature = elemSignature(next);
          this.add_to_map(next, tree);
          list.push(next);
          next._index = i;
          next = goForward({
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
      var rule = onExclusionList(elem, this.exclude_changes);

      // If we can't find a rule for the element, or it's change isn't excluded
      if(!rule || !rule.method.hasOwnProperty(match.type)) return true;

      // If we're permitted to change attributes, check that only those ones have
      if(match.type == "attr") {
        return !this.attr_changes_match(elem, match.elem, rule.method.attr);
      }
    },

    attr_changes_match: function(elemA, elemB, exclude) {
      var checked = [],
          length = elemA.attributes.length, attr, i, attrA, attrB, exclusion;

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
          else if(exclusion instanceof RegExp &&
                  removeMatchGroups(attrA, exclusion) !== removeMatchGroups(attrB, exclusion)) {
            return false;
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
          promise, progress,
          typeA, typeB, differences, previousReport, types, forwardA, forwardB;

      if(nextA === undefined) {
        nextA = goForward({ stop: this.a, all: true, exclude: this.exclude_completely });
        nextB = goForward({ stop: this.b, all: true, exclude: this.exclude_completely });
      }

      while(nextA !== null && nextB !== null && i < 25) {
        typeA = nextA && nodeType(nextA);
        typeB = nextB && nodeType(nextB);
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
            differences = elementStylesDiffer(nextA, nextB);

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
                  sameIgnoringSpaces(nextA, nextB) &&
                  textVisuallyDifferent(nextA, nextB)) {
            that._difference("space", nextA, nextB);
          }
        }

        if(forwardA) {
          nextA = goForward({
            last: nextA,
            stop: that.a,
            all: true,
            exclude: that.exclude_completely
          });
        }
        if(forwardB) {
          nextB = goForward({
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
