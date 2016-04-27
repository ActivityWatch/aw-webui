import json
import logging
from typing import Mapping, List
from datetime import datetime

from flask import Flask, request, make_response

app = Flask("aw-webui", static_folder='site')
logger = logging.getLogger("aw-webui")


@app.route("/")
def index():
    return app.send_static_file('index.html')


def main():
    """Called from __main__.py"""
    app.run(debug=True, port=9898)

