#!/usr/bin/env node

const gltfjsx = require('./gltfjsx')
const argv = require('yargs')
  .boolean('animation')
  .boolean('draco')
  .option('draco', { alias: 'd', describe: 'Adds DRACOLoader' })
  .option('animation', { alias: 'a', describe: 'Extracts animation clips' })
  .option('compress', { alias: 'c', describe: 'Removes names and empty groups' })
  .option('precision', { alias: 'f', default: 2, describe: 'Decimal number precision', type: 'number' })
  .usage('npx gltfjsx input.gltf [Output.js] [options]')
  .help().argv

if (argv._[0]) {
  console.log('converting', argv._[0], 'to', argv._[1])
  gltfjsx(argv._[0], argv._[1], argv)
  console.log('done.')
} else {
  console.log('missing the input filename. type: gltfjsx --help')
}
