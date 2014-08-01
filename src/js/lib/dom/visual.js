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

  function equalValues(obj, keys) {
    var length = keys.length,
        value, i;

    for(i = 0; i < length; i++) {
      if(i === 0) value = obj[keys[i]];
      else if(obj[keys[i]] !== value) return false;
    }

    return true;
  }

  /*function spaceImportant(node, nextFn) {
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
   */
  /*function differentSpaces(valueA, valueB) {
      var aLeft  = valueA.match(LEFT_WHITESPACE_REGEX)  === null,
          bLeft  = valueB.match(LEFT_WHITESPACE_REGEX)  === null,
          aRight = valueA.match(RIGHT_WHITESPACE_REGEX) === null,
          bRight = valueB.match(RIGHT_WHITESPACE_REGEX) === null,
          differences = [];

      if(aLeft != bLeft) differences.push("left");
      if(aRight != bRight) differences.push("right");

      return differences;
   }*/

  return {

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
     * @return {Boolean} Whether these two elements styles differ.
     */
    elemsDiffer: function(elemA, elemB) {
      var computedDifferences = styleComputedDifferences(elemA, elemB),
          sharedDifferences = { a: {}, b: {} },
          sharedCount = 0,
          ruleDifferences, difference;

      if(computedDifferences.length) {
        ruleDifferences = styleRuleDifference(elemA, elemB);

        for(difference in ruleDifferences) {
          if(computedDifferences.filter(startsWith(difference)).length > 0) {
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
  };
});
