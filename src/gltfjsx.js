import 'jsdom-global'
import fs from 'fs'
import path from 'path'
import transform from './utils/transform.js'

import prettier from 'prettier'
import THREE from 'three'
global.THREE = THREE

import './bin/GLTFLoader.js'
import DracoLoader from './bin/DRACOLoader.js'
THREE.DRACOLoader.getDecoderModule = () => {}
import parse from './utils/parser.js'

const gltfLoader = new THREE.GLTFLoader()
gltfLoader.setDRACOLoader(new DracoLoader())

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length)
  var view = new Uint8Array(ab)
  for (var i = 0; i < buf.length; ++i) view[i] = buf[i]
  return ab
}

export default function (file, output, options) {
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
        if (options.transform || options.instance || options.instanceall) {
          const { name } = path.parse(file)
          const transformOut = path.join(name + '-transformed.glb')
          await transform(file, transformOut, options)
          file = transformOut
        }
        resolve()

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
                //plugins: [parserBabel],
              })
            )
            stream.end()
            resolve()
          },
          reject
        )
      }
    })
  })
}
