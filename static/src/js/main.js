(function(Promise, Compare, log) { "use strict";

  try {
    document.domain = "compare.js";
  }
  catch(e) {
    log("FAILed to set document.domain to compare.js - make sure that you've " +
        "your ServerName is correctly set to compare.js");
  }

  function htmlEntities(str) {
    return String(str).replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;");
  }

  function cacheBust(url) {
    var delimiter = url.indexOf("?") != 1 ? "?" : "&";
    return url + delimiter + "_cachebust=" + Date.now();
  }

  var compareCtrl = {
    init: function() {
      this.responseActive = false;
      this.frameA = this.make_iframe();
      this.frameB = this.make_iframe();
      this.parse_dom();
      this.settings = {};
      this.events();
    },

    parse_dom: function() {
      this.wrapper = document.getElementById("wrapper");

      this.inA = document.getElementById("page-a");
      this.inB = document.getElementById("page-b");
      this.startOverBtn = document.getElementById("do-start-over");
      this.inBtn = document.getElementById("do-compare");

      this.loading = document.getElementById("loading");

      // Settings
      this.settingsDom = {
        toggle: document.getElementById("settings-toggle"),
        cacheBust: document.getElementById("settings-cache-bust"),
        mode: document.getElementById("settings-mode")
      };

      this.response = document.getElementById("response");
      this.responseIcon = document.getElementById("response-icon");
      this.responseSummary = document.getElementById("response-summary");
      this.responseDetails = document.getElementById("response-details");
    },

    process_settings: function() {
      this.settings.cacheBust = this.settingsDom.cacheBust.value === "yes";
      this.settings.mode = this.settingsDom.mode.value;
    },

    process_start_over: function() {
      this.process_comparison(true);
    },

    process_comparison: function(forceRestart) {
      var contentA, contentB;

      if(this.inA.value === "" || this.inB.value === "") {
        return;
      }

      this.process_settings();
      this.toggle_settings(false);
      this.inBtn.className = "";
      this.loading.setAttribute("class", "visible");
      this.remove_response();

      if(forceRestart === true || this.settings.mode === "single") {
        contentA = this.get_contents(this.frameA, this.inA.value);
        contentB = this.get_contents(this.frameB, this.inB.value);

        Promise.all([contentA, contentB]).then(
          this.do_compare.bind(this),
          this.compare_failed.bind(this)
        );
      }

      else {
        this.do_compare([this.frameA.contentDocument.body,
                         this.frameB.contentDocument.body]);
      }
    },

    response_active: function() {
      this.responseActive = true;
      this.wrapper.setAttribute("class", "with-response");
    },

    response_inactive: function() {
      this.responseActive = false;
      this.wrapper.removeAttribute("class");
    },

    loading_finished: function() {
      this.loading.removeAttribute("class");
    },

    do_compare: function(results) {
      var differences, difference;

      this.compare = new Compare({
        a: results[0],
        b: results[1]
      });

      differences = this.compare.differences;

      this.loading_finished();
      this.response_active();

      for(difference in differences) {
        if(differences[difference].length !== 0) {
          this.differences_true(differences);
          return;
        }
      }

      this.differences_false();
    },

    remove_response: function() {
      this.response.removeAttribute("class");
      this.responseIcon.removeAttribute("class");
      this.responseSummary.innerHTML = "";
      this.responseDetails.innerHTML = "";
    },

    differences_true: function(aspects) {
      var total = 0,
          differences = document.createElement("ul"),
          aspect, reports, li, count, i;

      for(aspect in aspects) {
        reports = aspects[aspect];
        count = reports.length;

        total += reports.length;
        for(i = 0; i < count; i ++) {
          li = document.createElement("li");
          li.innerHTML = this.report_difference(aspect, reports[i]);
          differences.appendChild(li);
        }
      }

      if(this.compare.stopped_at_max) total += "+";

      this.response.setAttribute("class", "errors");
      this.responseIcon.setAttribute("class", "issues fa fa-exclamation-circle");
      this.responseSummary.innerHTML = total + " Difference(s) Found";
      this.responseDetails.appendChild(differences);
    },

    differences_false: function() {
      this.response.setAttribute("class", "identical");
      this.responseIcon.setAttribute("class", "fa fa-check-circle");
      this.responseSummary.innerHTML = "Pages are identical";
      this.responseDetails.innerHTML = "We've checked the pages for both DOM and " +
                                       "visual differences, and we couldn't find any!";
    },

    report_difference: function(aspect, report) {
      switch(aspect) {
        case "retag":
          return "Tag change" + 
                 "<code class=\"a\">" + 
                   htmlEntities(report[0]._originalSig) +
                 "</code>" +
                 "<code class=\"b\">" +
                   htmlEntities(report[1]._originalSig) +
                 "</code>";

        case "reattribute":
          return "Attribute change" +
                 "<code class=\"a\">" + 
                   htmlEntities(report[0]._originalSig) +
                 "</code>" +
                 "<code class=\"b\">" +
                   htmlEntities(report[1]._originalSig) +
                 "</code>";

        case "removed":
          return "Element removed" +
                 "<code class=\"a removed\">" +
                   htmlEntities(report[0]._originalSig) +
                 "</code>";

        case "added":
          return "Element added" +
                 "<code class=\"b\">" +
                   htmlEntities(report[0]._originalSig) +
                 "</code>";

        case "text":
          return "Text changed" +
                 "<code class=\"a\">" +
                   htmlEntities(report[0]._originalSig) +
                 "</code>" +
                 "<code class=\"b\">" +
                   htmlEntities(report[1]._originalSig) +
                 "</code>";

        case "moved":
          return "Element Moved" +
                 "<code class=\"a\">" +
                   htmlEntities(report[0]._originalSig) +
                 "</code>";

        case "style":
          var diff = report[0]._styleDiff,
              affecting = report[0]._styleAffects,
              aText = "", bText = "",
              aCount = Object.keys(diff.a).length,
              bCount = Object.keys(diff.b).length,
              ruleName;

          for(ruleName in diff.a) {
            if(aCount > 1) aText += "\n  ";
            aText += ruleName + ": " + diff.a[ruleName] + "; ";
          }

          for(ruleName in diff.b) {
            if(bCount > 1) bText += "\n  ";
            bText += ruleName + ": " + diff.b[ruleName] + "; ";
          }

          if(aCount > 1) aText += "\n";
          if(bCount > 1) bText += "\n";

          return "Style change affecting " + affecting + " element(s)" +
                 "<code class=\"c\">" +
                   htmlEntities(report[0]._originalSig) +
                 "</code>" + 
                 "<code class=\"a\">" +
                   "{ " + aText + "}" +
                 "</code>" +
                 "<code class=\"b\">" +
                   "{ " + bText + "}" +
                 "</code>";
      }
    },

    compare_failed: function(response) {
      this.loading_finished();
      this.remove_response();
      this.response_active();

      this.response.setAttribute("class", "errors");
      this.responseIcon.setAttribute("class", "issues fa fa-exclamation-circle");
      this.responseSummary.innerHTML = "Comparison failed";

      if(response.error.name === "SecurityError") {
        this.responseDetails.innerHTML = "Failed to access <em>" + response.url +
                                         "</em> due to cross-origin restrictions";
      }
      else {
        this.responseDetails.innerHTML = "An unknown error was raised whilst " +
                                         "trying to load " + response.url;
      }
    },

    make_iframe: function() {
      var frame = document.createElement("iframe");
      document.getElementById("iframes").appendChild(frame);
      return frame;
    },

    get_contents: function(frame, url) {
      frame.src = this.settings.cacheBust ? cacheBust(url) : url;
      frame.removeEventListener("load", frame._loadEvent);

      return new Promise(function(resolve, reject) {
        frame._loadEvent = function() {
          try {
            resolve(frame.contentDocument.body);
          }
          catch (e) {
            reject({ error: e, url: url });
          }
        };
        frame.addEventListener("load", frame._loadEvent);
      });
    },

    process_if_enter: function(e) {
      if(e.keyCode == 13) this.process_comparison();
    },

    toggle_settings: function(explicit) {
      if(explicit === true || explicit !== false && this.settingsDom.toggle.className === "") {
        this.settingsDom.toggle.className += "open";
      }
      else {
        this.settingsDom.toggle.className = "";
      }
    },

    toggle_mode: function() {
      document.body.className = "mode-" + this.settingsDom.mode.value;
      if(this.frameA.src === "" || this.frameB.src === "") {
        this.inBtn.className = "disabled";
      }
    },

    events: function() {
      this.inBtn.addEventListener("click", this.process_comparison.bind(this));
      this.startOverBtn.addEventListener("click", this.process_start_over.bind(this));
      this.inA.addEventListener("keypress", this.process_if_enter.bind(this));
      this.inB.addEventListener("keypress", this.process_if_enter.bind(this));
      this.settingsDom.toggle.addEventListener("click", this.toggle_settings.bind(this));
      this.settingsDom.mode.addEventListener("click", this.toggle_mode.bind(this));
    }
  };

  document.addEventListener("DOMContentLoaded", compareCtrl.init.bind(compareCtrl));

})(window.Promise,
   window.Compare,
   window.console.log.bind(window.console)
);
