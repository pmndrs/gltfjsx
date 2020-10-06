#!/usr/bin/env node
'use strict'
const React = require('react')
const importJsx = require('import-jsx')
const { render } = require('ink')
const meow = require('meow')

const App = importJsx('./src/components/App')

const cli = meow(
  `
	Usage
	  $ gltfjsx [Model.js] [options]

	Options
		--types, -t     Add Typescript definitions
		--verbose, -v   Verbose output w/ names and empty groups
		--precision, -p Number of fractional digits (default: 2)
		--draco, -d     Draco binary path
		--root, -r      Sets directory from which .gltf file is served

	Examples
	  $ gltfjsx model.glb
`,
  {
    flags: {
      types: { type: 'boolean', alias: 't' },
      verbose: { type: 'boolean', alias: 'v' },
      precision: { type: 'number', alias: 'p', default: 2 },
      draco: { type: 'string', alias: 'd' },
      root: { type: 'string', alias: 'r' },
    },
  }
)

if (cli.input.length === 0) {
  console.log(cli.help)
} else {
  render(React.createElement(App, { file: cli.input[0], ...cli.flags }))
}
