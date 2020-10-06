#!/usr/bin/env node
'use strict'
const React = require('react')
const importJsx = require('import-jsx')
const { render } = require('ink')

const Test = importJsx('./components/Test')

render(React.createElement(Test))
