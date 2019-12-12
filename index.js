#!/usr/bin/env node

const gltfjsx = require('./gltfjsx')
const argv = require('yargs')
  .boolean('animation')
  .boolean('draco')
  .option('draco', { alias: 'd', describe: 'adds DRACOLoader' })
  .option('animation', { alias: 'a', describe: 'extracts animation clips' })
  .usage('npx react-three-fiber input.gltf [Output.js] [options]')
  .help().argv

console.log(argv)

gltfjsx(argv._[0], argv._[1], { draco: argv.draco, animation: argv.animation })
