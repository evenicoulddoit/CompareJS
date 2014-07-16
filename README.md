Compare.js
==========

Compare.js is a comparison tool which can be used to find both DOM-based and visual changes between two web pages. Compare.js is entirely browser driven, and relies on web-server configuration in order to work properly.


Use Cases
---------
Compare.js should on pages with *few expected differences*. It's most obvious use is as a test tool, to provide assurances that code changes have not effected the actual output. In particular, Compare.js allows you to refactor in confidence, including:

* Moving HTML attributes around and retabbing
* Removing redundant / repeated CSS styles


Browser Compatibility*
---------------------
* Chrome 33+ 
* Firefox 28+ *(Performance issues)*
* IE9+

\* *Current esimates based on caniuse tables*


Usage
-----
Start by entering two comparison URLs. Hit enter or click on the green (re)start button. Two IFrames will then appear, and begin to load & compare your pages. The results will be shown below the frames. By exposing the frames, you can compare their contents at any time, and so checking modals and POST requests are also possible. Simply click the red "compare" button and the current state of the frames will be compared.

Exclusions
----------
There may be cases where erroneous differences are reported. Examples include social network APIs adding elements with differing IDs to the page, and Cross-site request forgery (CSRF) tokens. To prevent these being reported, you can add an exclusions JSON block from the menu. These rules can instruct Compare.js to either ignore changes to a certain attribute of an element, or to skip and element and it's children entirely. Some examples include:

* Ignore CSRF tokens in Django

```
{
  "tag": "input",
  "attributes": {
    "name": "csrfmiddlewaretoken",
    "type": "hidden"
  },
  "method": {
    "attr": {
      "value": "*"
    }
  }
}
```
    
* Ignoring all IFrames

```
{
  "tag": "iframe"
}
```
    
* Ignoring a unique cache-busting number appended to an image URL

```
{
  "tag": "img",
  "method": {
    "attr": {
      "src": "[\\w/-_+]+(\\.\\d+)\\.(?:jpe?g|png|gif)"
    }
  }
}
```


Web Server Configuration
------------------------
Utilising JavaScript's great DOM libraries, means that you can use any compatible browser to run your tests, rather than taking a server-side, headless-browser approach which might not yield as accurate results. However, with the browser comes frustrating limitations.

Comparisons are made by loading 2 remotes sites within IFrames, and inspecting the result. In order to do this, we need to enable Cross-Origin Resource Sharing (CORS). The remote sites *must* both be descendants of compare.js *and* must set their domain property to compare.js (or another ServerName or your choice). Therefore you will have the following setup:

1) The tool itself hosted at http://compare.js

2) Your base website hosted at http://a.compare.js

3) Your new website hosted at http://b.compare.js

Both `a.compare.js` and `b.compare.js` will need to include the script:

    <script type="text/javascript">
        try {
            document.domain = "compare.js";
        }
        catch(e) {
            console.error("Failed to set the domain to compare.js, please " +
                          "check your Apache config");
        }
    </script>


Todos
-----
Compare.js is very much pre-alpha and there are a lot of things which need cleaning up:

* Performance improvements
* Made AMD
* Reporting all style changes, even if unexplained
* Check space changes are important
