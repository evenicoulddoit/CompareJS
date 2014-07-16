define([], function() { "use strict";
  var MULTI_SPACE_REGEX = /\s{2,}/g;

  return {

    nodeType: function(node) {
      return {
        1: "element",
        3: "text"
      }[node.nodeType.toString()];
    },

    /**
     * With a given element, produce a string descibing it's type and attribute
     * @param  {Element} elem
     * @return {string}
     */
    signature: function(elem) {
      var tagName = elem.tagName.toLowerCase(),
          attrStr = this.getAttrStr(elem),
          textStr = this.getTextStr(elem),
          tagSig = "<" + tagName + attrStr + ">";

      elem._sig = elem._originalSig = tagSig + textStr + "</" + tagName + ">";

      elem._tagSig = tagSig;
      elem._attrStr = attrStr;
      elem._textStr = textStr;

      return elem._sig;
    },

    getTextStr: function(elem) {
      var length = elem.childNodes.length,
          nodes = [], node, i;

      for(i = 0; i < length; i++) {
        node = elem.childNodes[i];
        if(this.nodeType(node) == "text") {
          nodes.push(node.nodeValue);
        }
      }

      return nodes.join(" ").replace(MULTI_SPACE_REGEX, " ").trim();
    },

    getAttrStr: function(elem) {
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
    },

    /**
     * Check whether a given node is an element and has a block context
     * @param  {Node} node
     * @return {Boolean}
     */
    hasBlockContext: function(node) {
      var displays = ["inline", "inline-block"], style;

      if(!(node instanceof window.Element)) return false;

      style = window.getComputedStyle(node);
      return (style.getPropertyValue("float") != "none" ||
              displays.indexOf(style.getPropertyValue("display")) == -1);
    },

    sameIgnoringSpaces: function(nodeA, nodeB) {
      return (nodeA.nodeValue.replace(MULTI_SPACE_REGEX, "") ===
              nodeB.nodeValue.replace(MULTI_SPACE_REGEX, ""));
    }
  };
});
