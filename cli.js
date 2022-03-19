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
    --types, -t         Add Typescript definitions
    --keepnames, -k     Keep original names
    --keepgroups, -K    Keep (empty) groups
    --meta, -m          Include metadata (as userData)
    --shadows, s        Let meshes cast and receive shadows
    --printwidth, w     Prettier printWidth (default: 120)
    --precision, -p     Number of fractional digits (default: 2)
    --draco, -d         Draco binary path
    --root, -r          Sets directory from which .gltf file is served
    --instance, -i      Instance re-occuring geometry
    --instanceall, -I   Instance every geometry (for cheaper re-use)
    --transform, -T     Transform the asset for the web (draco, prune, resize)
    --aggressive, -a    Aggressively prune the graph (empty groups, transform overlap) 
    --debug, -D         Debug output
`,
  {
    flags: {
      types: { type: 'boolean', alias: 't' },
      keepnames: { type: 'boolean', alias: 'k' },
      keepgroups: { type: 'boolean', alias: 'K' },
      shadows: { type: 'boolean', alias: 's' },
      printwidth: { type: 'number', alias: 'p', default: 1000 },
      meta: { type: 'boolean', alias: 'm' },
      precision: { type: 'number', alias: 'p', default: 2 },
      draco: { type: 'string', alias: 'd' },
      root: { type: 'string', alias: 'r' },
      instance: { type: 'boolean', alias: 'i' },
      instanceall: { type: 'boolean', alias: 'I' },
      transform: { type: 'boolean', alias: 'T' },
      aggressive: { type: 'boolean', alias: 'a' },
      debug: { type: 'boolean', alias: 'D' },
    },
  }
)

if (cli.input.length === 0) {
  console.log(cli.help)
} else {
  render(React.createElement(App, { file: cli.input[0], ...cli.flags }))
}
