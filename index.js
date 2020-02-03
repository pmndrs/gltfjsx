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

if (argv._[0]) {
  console.log('converting', argv._[0], 'to', argv._[1])
  gltfjsx(argv._[0], argv._[1], argv)
  console.log('done.')
} else {
  console.log('missing the input filename. type: gltfjsx --help')
}
