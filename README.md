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

\* *Based on tests passing & caniuse statistics*


Usage
-----
Start by entering two comparison URLs. Hit enter or click on the green (re)start button. Two IFrames will then appear, and begin to load & compare your pages. The results will be shown below the frames. By exposing the frames, you can compare their contents at any time, and so checking modals and POST requests are also possible. Simply click the red "compare" button and the current state of the frames will be compared.

Exclusions
----------
There may be cases where erroneous differences are reported. Examples include social network APIs adding elements with differing IDs to the page, and Cross-site request forgery (CSRF) tokens. To prevent these being reported, you can add an exclusions JSON block from the menu. These rules can instruct Compare.js to either ignore changes to a certain attribute of an element, or to skip and element and it's children entirely. Some examples include:

* Ignore CSRF tokens in Django

```JSON
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

```JSON
{
  "tag": "iframe"
}
```
    
* Ignoring a unique cache-busting number appended to an image URL

```JSON
{
  "tag": "img",
  "method": {
    "attr": {
      "src": "[\\w/-_+]+(\\.\\d+)\\.(?:jpe?g|png|gif)"
    }
  }
}
```


Fixing Security Issues
----------------------
Utilising JavaScript's great DOM libraries, means that you can use any compatible browser to run your tests, rather than taking a server-side, headless-browser approach which might not yield as accurate results. However, with the browser comes frustrating limitations.

Comparisons are made by loading 2 remotes sites within IFrames, and inspecting the result. In order to do this, we need to obey Cross-Origin Resource Sharing (CORS) policies, **or** tell our browser to ignore them.

* Instructing your browser to ignore CORS is the quickest approach, but **remember to turn it back on**. Here's how you can do it on Firefox (*Nix instructions):

  1) Create a new profile, `firefox -ProfileManager`
  
  2) Start a new session with this profile, and visit `about:config`
  
  3) Set the property `security.fileuri.strict_origin_policy` to `false`

* Obeying CORS is longest approach, but it'll mean you can run the comparison without tool without tweaking security policies.
To do this, all sites *must* be descendants of one another *and* set their domain property to compare.js (or another ServerName or your choice). An example configuration might be:

  1) Host the tool itself at http://compare.js
  
  2) Host your base site at http://a.compare.js
  
  3) Host your new site at http://b.compare.js
  
  Both `a.compare.js` and `b.compare.js` will need to include the script:
  
  ```HTML
  <script type="text/javascript">
    try {
      document.domain = "compare.js";
    }
    catch(e) {
      console.error("Failed to set the domain to compare.js, please " +
                    "check your Apache config");
    }
  </script>
  ```


Contributing
------------
The repository includes both a `.editorconfig` and a `.jshintrc`, to ensure that coding standards are adhered too.

Before developing, you will need to install the various requirements. After installing *Python*, *Ruby*, *PhantomJS* and *NodeJS*:
1. Install Python requirements

   ```bash
   pip install -r requirements.txt
   ```
   
2. Install Ruby requirements

    ```bash
    gem install bundler
    bundle install
    ```

3. Install RequireJS globally

    ```bash
    [sudo] npm install -g requirejs
    ```

4. Install JSHint globally

    ```bash
    [sudo] npm install -g jshint
    ```

5. Install Bower requirements

    ```bash
    [sudo] npm install -g bower
    bower install
    ```

Whilst developing from the `/src` directory, you will need to compile your Sass files on the fly using:

```bash
# In /src
compass watch
```

Before comitting changes, run the build script with:
    

```bash
python build.py
```

This will compile all your source files, and lint them for any existing issues.

Todos
-----
Compare.js is very much pre-alpha and there are a lot of things which need cleaning up:

* Performance improvements
* Reporting all style changes, even if unexplained
* Check space changes are important
