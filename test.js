const gltfjsx = require('./gltfjsx')
const fg = require('fast-glob')
const fs = require('fs-extra')

fs.removeSync('.test')
fs.mkdirSync('.test')

const config = { types: false, precision: 2, verbose: false, draco: undefined, silent: true }
const entries = fg.sync(['node_modules/glTF-Sample-Models/2.0/**/*.{gltf,glb}'], { dot: true })

for (let entry of entries) {
  let file = entry
  let nameExt = file.match(/[-_\w]+[.][\w]+$/i)[0]
  let name = nameExt.split('.').slice(0, -1).join('.')
  let output = '.test/' + name.charAt(0).toUpperCase() + name.slice(1) + (config.types ? '.tsx' : '.js')
  console.log(`converting ${file}`)
  gltfjsx(file, output, config)
}

fs.removeSync('.test')
