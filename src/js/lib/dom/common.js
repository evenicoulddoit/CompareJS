define(["regexp"], function(regexp) { "use strict";
  var IGNORE_ATTRIBUTE_SPACES = ["class"];

  return {

    isNode: function(unknown) {
      return (typeof (unknown || {}).nodeType === "number");
    },

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

      return nodes.join(" ").replace(regexp.MULTI_SPACE, " ").trim();
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
        attrStr += " " + attr + "=\"" + this.attrValue(elem, attr) + "\"";
      }

      return attrStr;
    },

    /**
     * Retrieve the value of a specified attribute for a given element.
     * If spaces are marked as unimportant for this attribute, trim them.
     * @param  {Element} elem
     * @param  {String} attr - The name of the attribute to retrieve
     * @return {String} The value of the attribute
     */
    attrValue: function(elem, attr) {
      var val = elem.getAttribute(attr);

      if(IGNORE_ATTRIBUTE_SPACES.indexOf(attr) !== -1) {
        val = val.trim().replace(regexp.MULTI_SPACE, " ");
      }

      return val;
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
      return (nodeA.nodeValue.replace(regexp.MULTI_SPACE, "") ===
              nodeB.nodeValue.replace(regexp.MULTI_SPACE, ""));
    }
  };
});
