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
	  $ npx gltfjsx [Model.js] [options]

	Options
    --types, -t      Add Typescript definitions
    --verbose, -v    Verbose output w/ names and empty groups
    --meta, -m       Include metadata (as userData)
    --shadows, s     Let meshes cast and receive shadows
    --printwidth, w  Prettier printWidth (default: 120)
    --precision, -p  Number of fractional digits (default: 2)
    --draco, -d      Draco binary path
    --root, -r       Sets directory from which .gltf file is served
    --transform, -T  Transform the asset for the web (draco, prune, resize)
    --debug, -D      Debug output
`,
  {
    flags: {
      types: { type: 'boolean', alias: 't' },
      verbose: { type: 'boolean', alias: 'v' },
      shadows: { type: 'boolean', alias: 's' },
      printwidth: { type: 'number', alias: 'p', default: 120 },
      meta: { type: 'boolean', alias: 'm' },
      precision: { type: 'number', alias: 'p', default: 2 },
      draco: { type: 'string', alias: 'd' },
      root: { type: 'string', alias: 'r' },
      transform: { type: 'boolean', alias: 'T' },
      debug: { type: 'boolean', alias: 'D' },
    },
  }
)

if (cli.input.length === 0) {
  console.log(cli.help)
} else {
  render(React.createElement(App, { file: cli.input[0], ...cli.flags }))
}
