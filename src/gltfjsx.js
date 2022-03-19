const fs = require('fs')
const path = require('path')
const prettier = require('prettier')
const parserBabel = require('prettier/parser-babel')
require('jsdom-global')()
const THREE = (global.THREE = require('three'))
require('./bin/GLTFLoader')
const DracoLoader = require('./bin/DRACOLoader')
THREE.DRACOLoader.getDecoderModule = () => {}
const parse = require('./utils/parser')
const transform = require('./utils/transform')

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length)
  var view = new Uint8Array(ab)
  for (var i = 0; i < buf.length; ++i) view[i] = buf[i]
  return ab
}

const gltfLoader = new THREE.GLTFLoader()
gltfLoader.setDRACOLoader(new DracoLoader())

module.exports = function (file, output, options) {
  function getRelativeFilePath(file) {
    const filePath = path.resolve(file)
    const rootPath = options.root ? path.resolve(options.root) : path.dirname(file)
    const relativePath = path.relative(rootPath, filePath) || ''
    if (process.platform === 'win32') return relativePath.replace(/\\/g, '/')
    return relativePath
  }

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(output)
    stream.once('open', async (fd) => {
      if (!fs.existsSync(file)) {
        reject(file + ' does not exist.')
      } else {
        // Process GLTF
        if (options.transform) {
          const { name } = path.parse(file)
          const transformOut = path.join(name + '-transformed.glb')
          if (options.setLog) options.setLog((state) => [...state, 'transforming ' + transformOut])
          await transform(file, transformOut, {})
          file = transformOut
        }

        const filePath = getRelativeFilePath(file)
        const data = fs.readFileSync(file)
        const arrayBuffer = toArrayBuffer(data)
        gltfLoader.parse(
          arrayBuffer,
          '',
          (gltf) => {
            stream.write(
              prettier.format(parse(filePath, gltf, options), {
                semi: false,
                printWidth: options.printwidth || 1000,
                singleQuote: true,
                jsxBracketSameLine: true,
                parser: options.types ? 'babel-ts' : 'babel',
                plugins: [parserBabel],
              })
            )
            stream.end()
            if (options.setLog) setTimeout(() => resolve(), (options.timeout = options.timeout + options.delay))
            else resolve()
          },
          reject
        )
      }
    })
  })
}
