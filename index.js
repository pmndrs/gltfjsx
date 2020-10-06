#!/usr/bin/env node

const version = require('./package.json').version
const gltfjsx = require('./gltfjsx')
const argv = require('yargs')
  .option('types', { alias: 't', describe: 'Adds Typescript definitions', type: 'boolean' })
  .option('verbose', {
    alias: 'v',
    default: false,
    describe: 'Verbose output w/ names and empty groups',
    type: 'boolean',
  })
  .option('precision', { alias: 'p', default: 2, describe: 'Number of fractional digits', type: 'number' })
  .option('draco', { alias: 'd', describe: 'Draco path', default: undefined, type: 'string' })
  .option('root', { alias: 'r', describe: 'Sets directory from which .gltf file is served', type: 'string' })
  .option('silent', { alias: 's', describe: 'No console output', type: 'boolean' })
  .usage('npx gltfjsx model.gltf [Model.js] [options]')
  .help().argv

if (argv._[0]) {
  let file = argv._[0]
  let nameExt = file.match(/[-_\w]+[.][\w]+$/i)[0]
  let name = nameExt.split('.').slice(0, -1).join('.')
  let output = argv._[1] || name.charAt(0).toUpperCase() + name.slice(1) + (argv.types ? '.tsx' : '.js')

  console.log(`gltfjsx ${version}, converting ${file} to ${output}`)
  console.log('')
  gltfjsx(file, output, argv)
    .then(() => console.log('\ndone.'))
    .catch((err) => console.log('\nfailed.\n\n', err))
} else {
  console.log('missing the input filename. type: gltfjsx --help')
}
