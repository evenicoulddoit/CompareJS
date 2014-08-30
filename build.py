#!/usr/bin/python
import os
import shutil
import subprocess

from bs4 import BeautifulSoup

# Source directories
BASE_DIR = os.path.dirname(os.path.realpath(__file__))
SRC_DIR = os.path.join(BASE_DIR, "src")
TEST_DIR = os.path.join(BASE_DIR, "test")
JS_DIR = os.path.join(SRC_DIR, "js")

# Build configuration directories
BUILD_DIR = os.path.join(BASE_DIR, "dist")
CONFIG_HOME = os.path.join(BASE_DIR, "build-config")
SASS_CONFIG_FILE = os.path.join(CONFIG_HOME, "sass-config.rb")
JS_CONFIG_FILE = os.path.join(CONFIG_HOME, "require-config.js")
JS_NON_AMD = ("classlist.js", )

INDEX_HTML = os.path.join(SRC_DIR, "index.html")
JSHINT_IGNORE = ("require.js", "almond.js", "promise.js", "specificity.js",
                 "classlist.js")

IS_WINDOWS = os.name == "nt"


def change_cwd():
    """
    Change the current working directory to the project root
    """
    log("Setting working directory to: {0}".format(BASE_DIR), msg_type="title")
    os.chdir(BASE_DIR)
    log("OK", msg_type="response")


def create_built_dir():
    """
    Generate (and remove if pre-existing) a build directory into which the
    build files will be moved.
    """
    log("Creating ouput directory: {0}".format(BUILD_DIR), msg_type="title")
    if os.path.isdir(BUILD_DIR):
        shutil.rmtree(BUILD_DIR)
    os.mkdir(BUILD_DIR)
    log("OK", msg_type="response")


def compile_compass():
    """
    Use the Compass compiler to build the Sass files into a single minified
    CSS file.
    """
    log("Compiling Sass files", msg_type="title")
    call("compass", "compile", "-c", SASS_CONFIG_FILE)
    log("OK", msg_type="response")


def compile_js():
    """
    Compile the JavaScript AMD source files into a single uglified file.
    Copy non-AMD files over to the build 
    """
    log("Compiling JS files", msg_type="title")
    r_js = "r.js.cmd" if IS_WINDOWS else "r.js"
    call(r_js, "-o", JS_CONFIG_FILE)
    os.mkdir(os.path.join(BUILD_DIR, "js", "lib"))

    for script in JS_NON_AMD:
        log("Copying {0}".format(script))
        shutil.copyfile(os.path.join(JS_DIR, "lib", script),
                        os.path.join(BUILD_DIR, "js", "lib", script))

    log("OK", msg_type="response")


def compile_html():
    """
    Use beautifulsoup to parse the source HTML and modify the JS references.
    """
    log("Compiling HTML", msg_type="title")
    index_out = os.path.join(BUILD_DIR, "index.html")
    soup = None

    # 2.6 friendly
    with open(INDEX_HTML) as html_in:
        soup = BeautifulSoup(html_in)

        # Modify the JS script tag
        js_tag = soup.find("script", id="app-js")
        js_tag["src"] = "js/compare.js"
        del js_tag["data-main"]

    with open(index_out, "w") as html_out:
        html_out.write(soup.prettify())
        log("OK", msg_type="response")


def jshint_files():
    """
    Lint all JS files to ensure that they meet the projects standards.
    """
    log("JSHinting files", msg_type="title")
    scripts = [os.path.join(BASE_DIR, directory, doc)
               for directory, _, docs in os.walk("src/js")
               for doc in docs
               if doc.endswith(".js") and doc not in JSHINT_IGNORE]

    for script in scripts:
        call("jshint", script)

    log("OK", msg_type="response")


def run_js_tests():
    """
    Create an index.html file from a template, find all the test suites,
    and modify the Qunit HTML page to include all of them.
    """
    log("Building & Running JS tests", msg_type="title")

    try:
        os.remove(os.path.join(TEST_DIR, "index.html"))
    except OSError:
        pass

    html = None
    scripts = find_js_tests()
    script_tpl = '<script src="{0}" type="text/javascript"></script>'
    scripts_html = "\n  ".join([script_tpl.format(script)
                                for script in scripts])

    with open(os.path.join(TEST_DIR, "_index.tpl")) as html_in:
        html = html_in.read().replace("{{TESTS}}", scripts_html)

    with open(os.path.join(TEST_DIR, "index.html"), "w") as html_out:
        html_out.write(html)

    os.chdir(TEST_DIR)
    call("phantomjs.exe" if IS_WINDOWS else "phantomjs",
         "runner.js", "index.html")
    os.chdir(BASE_DIR)

    log("OK", msg_type="response")



def msg_success():
    """
    The message to log on successful build
    """
    log("")
    log("\\o/ BUILD COMPLETE \\o/")


def msg_fail():
    """
    The message to log on failed build
    """
    log("")
    log("BUILD FAILED")


def do_build():
    """
    Compile all source files and generate a build directory with the results.
    """
    try:
        change_cwd()
        jshint_files()
        run_js_tests()
        create_built_dir()
        compile_compass()
        compile_js()
        compile_html()
        msg_success()
    except subprocess.CalledProcessError:
        msg_fail()


def call(*args):
    """
    Try to call a shell command, raising an exception on stderr
    """
    subprocess.check_call(args, shell=IS_WINDOWS)


def log(msg, msg_type="standard"):
    """
    Logging abstraction layer
    """
    if msg_type == "title":
        print "\n"
        print msg
        print "==============================================================="
    elif msg_type == "response":
        print ">>> {0}".format(msg)
    else:
        print msg


def find_js_tests():
    """
    Search the test directory for all JavaScript files beginning with "test"
    and return their path relative to the test directory.
    """
    return [url_js_path(os.path.join(directory, doc))
            for directory, _, docs in os.walk(TEST_DIR)
            for doc in docs
            if doc.startswith("test_") and doc.endswith(".js")]


def url_js_path(script):
    """
    Given an absolute JavaScript test filepath, make it relative to the
    test directory, and convert all path separators to forward slashes
    """
    return script[len(TEST_DIR) + 1:].replace(os.sep, "/")


if __name__ == "__main__":
    do_build()
