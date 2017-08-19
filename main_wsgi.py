#!/usr/bin/env python3

import json
import os

import flask

app = flask.Flask(__name__)


@app.route('/')
def index():
    return flask.render_template('index.html', **{
        'data': json.dumps(_get_data())
    })


@app.route('/update/', methods=['POST'])
def update():
    print(flask.request.json)
    with open(_get_data_path(), 'w') as output:
        output.write(json.dumps(flask.request.json, indent=4))
    return '{}'


def _get_data():
    return json.loads(open(_get_data_path()).read())


def _get_data_path():
    our_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(our_dir, 'data.json')

if __name__ == '__main__':
    app.run(debug=True)
