define([], function() { "use strict";
  return {
    removeMatchGroups: function(str, re) {
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
  };
});
