#!/usr/bin/python

import os
import shutil
from subprocess import call

from bs4 import BeautifulSoup


BASE_DIR = os.path.dirname(os.path.realpath(__file__))
BUILD_DIR = os.path.join(BASE_DIR, "out")
SRC_DIR = os.path.join(BASE_DIR, "src")

CONFIG_HOME = os.path.join(BASE_DIR, "build-config")
SASS_CONFIG_FILE = os.path.join(CONFIG_HOME, "sass-config.rb")
JS_CONFIG_FILE = os.path.join(CONFIG_HOME, "require-config.js")

INDEX_HTML = os.path.join(SRC_DIR, "index.html")


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
    call(["compass", "compile", "-c", SASS_CONFIG_FILE])
    log("OK", msg_type="response")


def compile_js():
    """
    Compile the JavaScript AMD source files into a single uglified file.
    """
    log("Compiling RequireJS files", msg_type="title")
    call(["r.js", "-o", JS_CONFIG_FILE])
    log("OK", msg_type="response")


def compile_html():
    """
    Use beautifulsoup to parse the source HTML and modify the JS references.
    """
    log("Compiling HTML", msg_type="title")
    index_out = os.path.join(BUILD_DIR, "index.html")
    html = None

    # 2.6 friendly
    with open(INDEX_HTML) as html_in:
        soup = BeautifulSoup(html_in)

        # Modify the JS script tag
        js_tag = soup.find("script", id="app-js")
        js_tag["src"] = "js/compare.js"
        del js_tag["data-main"]

        html = soup.prettify()

    with open(index_out, "w") as html_out:
        html_out.write(soup.prettify())
        log("OK", msg_type="response")


def finish_msg():
    log("")
    log("\o/ BUILD COMPLETE \o/")


def do_build():
    """
    Compile all source files and generate a build directory with the results.
    """
    change_cwd()
    create_built_dir()
    compile_compass()
    compile_js()
    compile_html()
    finish_msg()


def log(msg, msg_type="standard"):
    if msg_type == "title":
        print "\n"
        print msg
        print "==============================================================="
    elif msg_type == "response":
        print ">>> {0}".format(msg)
    else:
        print msg


if __name__ == "__main__":
    do_build()
