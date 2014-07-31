define(function(require) { "use strict";

  require(["promise", "app/model"], function(Promise, Compare) {
    var log = window.console.log.bind(window.console);

    if(window.location.search.indexOf("?same-origin") === -1) {
      try {
        document.domain = "compare.js";
      }
      catch(e) {
        log("FAILed to set document.domain to compare.js - make sure that you've " +
            "your ServerName is correctly set to compare.js");
      }
    }
    else {
      log("Compare.js - not setting document.domain - use relative URLs");
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
        this.isResponseActive = false;
        this.frameA = this.makeIframe();
        this.frameB = this.makeIframe();
        this.parseDom();
        this.settings = {};
        this.events();
        this.loadInputState();
      },

      parseDom: function() {
        this.wrapper = document.getElementById("wrapper");

        this.inA = document.getElementById("page-a");
        this.inB = document.getElementById("page-b");
        this.startOverBtn = document.getElementById("do-start-over");
        this.inBtn = document.getElementById("do-compare");


        // Settings
        this.settingsDom = {
          toggle: document.getElementById("settings-toggle"),
          cacheBust: document.getElementById("settings-cache-bust"),
          exclude: document.getElementById("settings-exclude")
        };

        this.response = document.getElementById("response");
        this.responseIcon = document.getElementById("response-icon");
        this.responseSummary = document.getElementById("response-summary");
        this.responseDetails = document.getElementById("response-details");
      },

      processSettings: function() {
        var exclude = this.settingsDom.exclude.value.trim();
        this.settings.cacheBust = this.settingsDom.cacheBust.value === "yes";
        if(exclude) {
          try {
            this.settings.exclude = JSON.parse(exclude);
          }
          catch(e) {
            if(e instanceof SyntaxError) {
              this.compareFailed("Failed to parse exclusions JSON block");
              throw e;
            }
          }
        }
        else {
          this.settings.exclude = [];
        }
      },

      processStartOver: function() {
        this.processComparison(true);
      },

      processComparison: function(loadFrame) {
        var contentA, contentB;

        if(this.inA.value === "" || this.inB.value === "") {
          return;
        }

        this.processSettings();
        this.toggleSettings(false);
        this.inBtn.className = "";
        this.wrapper.setAttribute("class", "loading");
        this.removeResponse();

        if(loadFrame === true) {
          this.reportProgress("Loading pages");
          contentA = this.getContents(this.frameA, this.inA.value);
          contentB = this.getContents(this.frameB, this.inB.value);

          Promise.all([contentA, contentB]).then(
            this.doCompare.bind(this, true),
            this.compareFailed.bind(this)
          ).catch(this.compareFailed.bind(this));
        }

        else {
          this.doCompare(false, [this.frameA.contentDocument.body,
                                 this.frameB.contentDocument.body]);
        }
      },

      responseActive: function() {
        this.isResponseActive = true;
        this.wrapper.setAttribute("class", "with-response");
      },

      responseInactive: function() {
        this.isResponseActive = false;
        this.wrapper.removeAttribute("class");
      },

      doCompare: function(withTimeout, results) {
        var that = this,
            timeout = withTimeout ? 2000 : 1000,
            compare;

        this.reportProgress("Calculating DOM differences");

        setTimeout(function() {
          try {
            compare = new Compare({
              a: results[0],
              b: results[1],
              exclude: that.settings.exclude
            });
            that.compare = compare;
          }
          catch(e) {
            return that.compareFailed(e);
          }

          if(compare.stoppedAtMax) {
            that.responseActive();
            return that.differencesTrue(compare.differences);
          }
          else {
            that._asyncVisual();
          }
        }, timeout);
      },

      /**
       * Perform visual comparisons asynchronously. On slower JS engines we need
       * to do this to prevent the browser from reporting the page as frozen,
       * and it also allows us to update the user with the progress
       * @param  {Object|undefined} resp - Either the previous async response or undefined
       */
      _asyncVisual: function(async) {
        var that = this, differences, difference;

        if(async !== undefined && async.calls > 2000) {
          this.compareFailed("Recursion Error");
        }

        else {
          if(async === undefined || async.progress < 100) {
            setTimeout(function() {
              try {
                async = that.compare.findVisualDifferences(async); 
                that.reportProgress("Calculating visual differences &mdash; " +
                                    async.progress + "% complete");
                that._asyncVisual(async);
              }
              catch(e) {
                return that.compareFailed(e);
              }
            }, 0);
          }
          else {
            differences = that.compare.differences;
            that.responseActive();

            for(difference in differences) {
              if(differences[difference].length !== 0) {
                return that.differencesTrue(differences);
              }
            }

            return that.differencesFalse();
          }
        }
      },

      removeResponse: function() {
        this.response.removeAttribute("class");
        this.responseIcon.removeAttribute("class");
        this.responseSummary.innerHTML = "";
        this.responseDetails.innerHTML = "";
      },

      differencesTrue: function(aspects) {
        var total = 0,
            differences = document.createElement("ul"),
            aspect, reports, li, count, i;

        for(aspect in aspects) {
          reports = aspects[aspect];
          count = reports.length;

          total += reports.length;
          for(i = 0; i < count; i ++) {
            li = document.createElement("li");
            li.innerHTML = this.reportDifference(aspect, reports[i]);
            differences.appendChild(li);
          }
        }

        if(this.compare.stoppedAtMax) total += "+";

        this.response.setAttribute("class", "errors");
        this.responseIcon.setAttribute("class", "issues fa fa-exclamation-circle");
        this.responseSummary.innerHTML = total + " Difference(s) Found";
        this.responseDetails.appendChild(differences);
      },

      differencesFalse: function() {
        this.response.setAttribute("class", "identical");
        this.responseIcon.setAttribute("class", "fa fa-check-circle");
        this.responseSummary.innerHTML = "Pages are identical";
        this.responseDetails.innerHTML = "We've checked the pages for both DOM and " +
                                         "visual differences, and we couldn't find any!";
      },

      reportProgress: function(progressString) {
        this.response.setAttribute("class", "loading");
        this.responseIcon.setAttribute("class", "fa fa-spin fa-spinner");
        this.responseSummary.innerHTML = progressString;
        this.responseDetails.innerHTML = "";
      },

      reportDifference: function(aspect, report) {
        switch(aspect) {
          case "tag":
            return "Tag change" + 
                   "<code class=\"a\">" + 
                     htmlEntities(report[0]._originalSig) +
                   "</code>" +
                   "<code class=\"b\">" +
                     htmlEntities(report[1]._originalSig) +
                   "</code>";

          case "attr":
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

      compareFailed: function(response) {
        this.wrapper.setAttribute("class", "with-response");
        this.removeResponse();
        this.responseActive();

        if(typeof response === "object" && response.name === "ReachedLimitError") {
          return this.differencesTrue(this.compare.differences);
        }

        this.response.setAttribute("class", "errors");
        this.responseIcon.setAttribute("class", "issues fa fa-exclamation-circle");
        this.responseSummary.innerHTML = "Comparison failed";

        if(typeof response === "string") {
          this.responseDetails.innerHTML = response;
        }
        else if(response.error !== undefined && response.error.name === "SecurityError") {
          this.responseDetails.innerHTML = "Failed to access <em>" + response.url +
                                           "</em> due to cross-origin restrictions";
        }
        else {
          this.responseDetails.innerHTML = "An unknown error was raised";
          log("Error details:", response);
        }
      },

      makeIframe: function() {
        var frame = document.createElement("iframe");
        document.getElementById("iframes").appendChild(frame);
        return frame;
      },

      getContents: function(frame, url) {
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

      processIfEnter: function(e) {
        if(e.keyCode == 13) this.processComparison(true);
      },

      toggleSettings: function(explicit) {
        if(explicit === true ||
           explicit !== false && this.settingsDom.toggle.className === "") {
          this.settingsDom.toggle.className += "open";
        }
        else {
          this.settingsDom.toggle.className = "";
        }
      },

      loadInputState: function() {
        var val;

        [this.inA, this.inB, this.settingsDom.exclude].forEach(function(input) {
          val = localStorage.getItem("saved-input" + input.id);
          if(val !== null) {
            input.value = val;
          }
        }, this);
      },

      saveInputState: function() {
        [this.inA, this.inB, this.settingsDom.exclude].forEach(function(input) {
          localStorage.setItem("saved-input" + input.id, input.value);
        }, this);
      },

      events: function() {
        this.inBtn.addEventListener("click", this.processComparison.bind(this));
        this.startOverBtn.addEventListener("click", this.processStartOver.bind(this));
        this.inA.addEventListener("keypress", this.processIfEnter.bind(this));
        this.inB.addEventListener("keypress", this.processIfEnter.bind(this));
        this.settingsDom.toggle.addEventListener("click", this.toggleSettings.bind(this));
        setInterval(this.saveInputState.bind(this), 1000);
      }
    };

    compareCtrl.init();
  });
});
