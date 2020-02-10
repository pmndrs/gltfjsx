#!/usr/bin/env node

const gltfjsx = require('./gltfjsx')
const argv = require('yargs')
  .boolean('animation')
  .boolean('draco')
  .option('draco', { alias: 'd', describe: 'Adds draco-Loader' })
  .option('animation', { alias: 'a', describe: 'Extracts animation clips' })
  .option('compress', { alias: 'c', describe: 'Removes names and empty groups' })
  .option('precision', { alias: 'p', default: 2, describe: 'Number of fractional digits', type: 'number' })
  .usage('npx gltfjsx model.gltf [Model.js] [options]')
  .help().argv

let file = argv._[0]
let nameExt = file.match(/[-_\w]+[.][\w]+$/i)[0]
let name = nameExt
  .split('.')
  .slice(0, -1)
  .join('.')
let output = argv._[1] || name.charAt(0).toUpperCase() + name.slice(1) + '.js'

if (argv._[0]) {
  console.log('converting', file, 'to', output)
  gltfjsx(file, nameExt, output, argv)
  console.log('done.')
} else {
  console.log('missing the input filename. type: gltfjsx --help')
}
