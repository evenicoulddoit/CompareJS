(function(Promise, Compare, log) { "use strict";

  function htmlEntities(str) {
    return String(str).replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;");
  }

  var compareCtrl = {
    init: function() {
      this.responseActive = false;
      this.parse_dom();
      this.events();
    },

    parse_dom: function() {
      this.wrapper = document.getElementById("wrapper");

      this.inA = document.getElementById("page-a");
      this.inB = document.getElementById("page-b");
      this.inBtn = document.getElementById("do-compare");

      this.loading = document.getElementById("loading");

      this.response = document.getElementById("response");
      this.responseIcon = document.getElementById("response-icon");
      this.responseSummary = document.getElementById("response-summary");
      this.responseDetails = document.getElementById("response-details");
    },

    process_comparison: function() {
      if(this.inA.value === "" || this.inB.value === "") {
        return;
      }

      var contentA = this.get_contents(this.inA.value),
          contentB = this.get_contents(this.inB.value);


      this.remove_response();
      this.loading.setAttribute("class", "visible");

      Promise.all([contentA, contentB]).then(
        this.do_compare.bind(this),
        this.compare_failed.bind(this)
      );
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
      var compare = new Compare(results[0], results[1]),
          differences = compare.differences, difference;

      log(results[0], results[1], differences);

      this.loading_finished();
      this.response_active();


      for(difference in differences.elements) {
        if(differences.elements[difference].length !== 0) {
          this.differences_dom(differences.elements);
          return;
        }
      }

      this.differences_none();
    },

    remove_response: function() {
      this.response.removeAttribute("class");
      this.responseIcon.removeAttribute("class");
      this.responseSummary.innerHTML = "";
      this.responseDetails.innerHTML = "";
    },

    differences_dom: function(aspects) {
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

      this.response.setAttribute("class", "errors");
      this.responseIcon.setAttribute("class", "issues fa fa-exclamation-circle");
      this.responseSummary.innerHTML = total + " DOM Difference(s) Found";
      this.responseDetails.appendChild(differences);
    },

    differences_none: function() {
      this.response.setAttribute("class", "identical");
      this.responseIcon.setAttribute("class", "fa fa-check-circle");
      this.responseSummary.innerHTML = "Pages are identical";
      this.responseDetails.innerHTML = "We've checked the pages for both DOM and " +
                                       "visual differences, and we couldn't find any!";
    },

    report_difference: function(aspect, report) {
      switch(aspect) {
        case "retag":
          return "You changed a tag...";

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
          return "You moved elements around" +
                 "<code class=\"a\">" +
                   htmlEntities(report[0]._originalSig) +
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

    get_contents: function(url) {
      var frame = document.createElement("iframe");
      frame.src = url;

      return new Promise(function(resolve, reject) {
        document.body.appendChild(frame);
        frame.addEventListener("load", function() {
          try {
            resolve(frame.contentDocument.body);
          }
          catch (e) {
            reject({ error: e, url: url });
          }
          finally {
            frame.remove();
          }
        });
      });
    },

    process_if_enter: function(e) {
      if(e.keyCode == 13) this.process_comparison();
    },

    events: function() {
      this.inBtn.addEventListener("click", this.process_comparison.bind(this));
      this.inA.addEventListener("keypress", this.process_if_enter.bind(this));
      this.inB.addEventListener("keypress", this.process_if_enter.bind(this));
    }
  };

  document.addEventListener("DOMContentLoaded", compareCtrl.init.bind(compareCtrl));

})(window.Promise,
   window.Compare,
   window.console.log.bind(window.console)
);
