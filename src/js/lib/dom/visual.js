define(["specificity"], function(specificity) { "use strict";

  var CSS_SELECTOR_REGEX = /,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/g;
  //    LEFT_WHITESPACE_REGEX  = /^\s+/,
  //    RIGHT_WHITESPACE_REGEX = /\s+$/,

  function startsWith(a) {
    return function(b) {
      return b.indexOf(a) === 0;
    };
  }

  function removeKeys(obj, keys) {
    var length = keys.length, i;
    for(i = 0; i < length; i++) {
      delete obj[keys[i]];
    }
    return obj;
  }

  /**
   * Where possible, combines margin and padding rules into their shorthand
   * variants (e.g. margin-top,bottom,left and right of 5px -> margin: 5px)
   * @param  {Object} differences - CSS rule & value pairs
   * @return {Object} the differences object modified in-place
   */
  function shorthandMarginPadding(differences) {
    var keys;

    ["margin", "padding"].forEach(function(rule) {
      keys = Object.keys(differences).filter(function(key) {
        return key.indexOf(rule + "-") === 0;
      });

      // We can only shorthand if all values are set and belong to the same rule
      if(keys.length !== 4 ||
         !equalValues(differences, keys, "src") ||
         !equalValues(differences, keys, "selector")) {
        return;
      }

      // We're going to combine into one, so set the base object on which to build
      differences[rule] = differences[keys[0]];

      // If the values are not all equal, we'll need to format the values properly
      if(!equalValues(differences, keys)) {

        // Equal left and values, required at least for a shorthand
        if(equalValues(differences, [rule + "-left", rule + "-right"])) {

          // Equal x's and equal y's
          if(equalValues(differences, [rule + "-top", rule + "-bottom"])) {
            differences[rule].value = [differences[rule + "-top"].value,
                                       differences[rule + "-left"].value].join(" ");
          }

          // Equal x's different top and bottom
          else {
            differences[rule].value = [differences[rule + "-top"].value,
                                       differences[rule + "-left"].value,
                                       differences[rule + "-bottom"].value].join(" ");
          }
        }

        // All different
        else {
          differences[rule].value = [differences[rule + "-top"].value,
                                     differences[rule + "-right"].value,
                                     differences[rule + "-bottom"].value,
                                     differences[rule + "-left"].value].join(" ");
        }
      }

      removeKeys(differences, [
        rule + "-top", rule + "-right", rule + "-bottom", rule + "-left"
      ]);
    });

    return differences;
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
   * Find the stylesheet rule differences between elements
   * @param  {Element} elemA
   * @param  {Element} elemB
   * @return {Object} - An object of property name -> property value pairs
   */
  function styleRuleDifferences(elemA, elemB) {
    var stylesA = findRulesFor(elemA),
        stylesB = findRulesFor(elemB),
        differences = {},
        checked = [],
        styleName, styleB;

    for(styleName in stylesA) {
      styleB = stylesB[styleName] || {};
      if(stylesA[styleName].value != styleB.value) {
        differences[styleName] = {
          a: stylesA[styleName],
          b: styleB.value ? styleB : undefined
        };
      }
      checked.push(styleName);
    }

    for(styleName in stylesB) {
      if(checked.indexOf(styleName) == -1) {
        differences[styleName] = {
          a: undefined,
          b: stylesB[styleName]
        };
      }
    }

    return differences;
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
                specs.push(specificity.calculate(selector));
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
            specificityAdd(spec, styles, rule);
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

  /**
   * Edit an object of rules mappings in-place, replacing items where the
   * specificity of the selector is at least as high as the existing
   * @param {Number} spec - The specificty value for these new rules
   * @param {Object} existingStyles - The existing rules
   * @param {CSSStyleRule} newRules - The new rule of styles to conditionally add
   * @returns {Object} the existing styles
   */
  function specificityAdd(spec, existingStyles, newRules) {
    var newStyles = newRules.style,
        newSelector = newRules.selectorText,
        newSrc = newRules.parentStyleSheet.href,
        length = newStyles.length,
        styleOrig, styleName, i;

    for(i = 0; i < length; i++) {
      styleOrig = newStyles[i];
      styleName = uniformName(styleOrig);

      if(!(styleName in existingStyles && spec < existingStyles[styleName].specificity)) {
        existingStyles[styleName] = {
          specificity: spec,
          value: newStyles.getPropertyValue(styleOrig),
          src: newSrc,
          selector: newSelector
        };
      }
    }

    return existingStyles;
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

  function equalValues(obj, keys, innerKey) {
    var length = keys.length,
        value, i;

    innerKey = innerKey || "value";

    for(i = 0; i < length; i++) {
      if(i === 0) value = obj[keys[i]][innerKey];
      else if(obj[keys[i]][innerKey] !== value) return false;
    }

    return true;
  }

  /**
   * TODO: Implement a test as to whether spaces make a visual difference

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
      if(DOM.hasBlockContext(previous)) {
        break;
      }
    }
    return false;
  }*/

  /**
   * Calculate whether space to the left and right differs between textNodes
   * @param {string} valueA - The text of node A
   * @param {string} valueB - The text of node B
   * @returns {Boolean} Whether both left and right are identical
  function differentSpaces(valueA, valueB) {
      var aLeft  = valueA.match(LEFT_WHITESPACE_REGEX)  === null,
          bLeft  = valueB.match(LEFT_WHITESPACE_REGEX)  === null,
          aRight = valueA.match(RIGHT_WHITESPACE_REGEX) === null,
          bRight = valueB.match(RIGHT_WHITESPACE_REGEX) === null,
          differences = [];

      if(aLeft != bLeft) differences.push("left");
      if(aRight != bRight) differences.push("right");

      return differences;
   }*/

  var exports = {

    /**
     * Given at least one text node, check if space changes matter.
     * TODO: Implement.
     * @param  {Text} [nodeA]
     * @param  {Text} [nodeB]
     * @return {Boolean}
     */
    textsDiffer: function(nodeA, nodeB) {
      return nodeA == nodeB ? false : false;
    },

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
     * @return {Object|null} An object of differences if any found, or null
     */
    elemsDiffer: function(elemA, elemB) {
      var computedDifferences = styleComputedDifferences(elemA, elemB),
          sharedDifferences = { a: {}, b: {} },
          sharedCount = 0,
          ruleDifferences, difference;

      if(computedDifferences.length) {
        ruleDifferences = styleRuleDifferences(elemA, elemB);

        for(difference in ruleDifferences) {
          if(computedDifferences.filter(startsWith(difference)).length > 0) {
            if(ruleDifferences[difference].a !== undefined) {
              sharedDifferences.a[difference] = ruleDifferences[difference].a;
            }
            if(ruleDifferences[difference].b !== undefined) {
              sharedDifferences.b[difference] = ruleDifferences[difference].b;
            }
            sharedCount ++;
          }
        }
      }

      ["a", "b"].forEach(function(tree) {
        shorthandMarginPadding(sharedDifferences[tree]);
      });

      return sharedCount !== 0 ? sharedDifferences: null;
    }
  };

  //>>includeStart("test", pragmas.test)
  exports._startsWith = startsWith;
  exports._removeKeys = removeKeys;
  exports._shorthandMarginPadding = shorthandMarginPadding;
  exports._styleComputedDifferences = styleComputedDifferences;
  exports._styleRuleDifferences = styleRuleDifferences;
  exports._findRulesFor = findRulesFor;
  exports._notEmpty = notEmpty;
  exports._elementMatches = elementMatches;
  exports._specificityAdd = specificityAdd;
  exports._uniformName = uniformName;
  exports._equalValues = equalValues;
  //>>includeEnd("test")

  return exports;
});
