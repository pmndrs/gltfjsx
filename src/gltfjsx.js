import 'jsdom-global'
import fs from 'fs'
import path from 'path'
import transform from './utils/transform.js'

import { GLTFLoader } from './bin/GLTFLoader.js'
import { DRACOLoader } from './bin/DRACOLoader.js'
DRACOLoader.getDecoderModule = () => {}
import parse from './utils/parser.js'

const gltfLoader = new GLTFLoader()
gltfLoader.setDRACOLoader(new DRACOLoader())

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length)
  var view = new Uint8Array(ab)
  for (var i = 0; i < buf.length; ++i) view[i] = buf[i]
  return ab
}

function roundOff(value) {
  return Math.round(value * 100) / 100
}

function getFileSize(file) {
  const stats = fs.statSync(file)
  let fileSize = stats.size
  let fileSizeKB = roundOff(fileSize * 0.001)
  let fileSizeMB = roundOff(fileSizeKB * 0.001)
  return {
    size: fileSizeKB > 1000 ? `${fileSizeMB}MB` : `${fileSizeKB}KB`,
    sizeKB: fileSizeKB,
  }
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
    const stream = fs.createWriteStream(path.resolve(output))
    stream.once('open', async (fd) => {
      if (!fs.existsSync(file)) {
        reject(file + ' does not exist.')
      } else {
        let size = ''
        // Process GLTF
        if (output && path.parse(output).ext === '.tsx') {
          options.types = true
        }
        
        if (options.transform || options.instance || options.instanceall) {
          const { name } = path.parse(file)
          const outputDir = path.parse(path.resolve(output ?? file)).dir;
          const transformOut = path.join(outputDir, name + '-transformed.glb')
          await transform(file, transformOut, options)
          const { size: sizeOriginal, sizeKB: sizeKBOriginal } = getFileSize(file)
          const { size: sizeTransformed, sizeKB: sizeKBTransformed } = getFileSize(transformOut)
          size = `${file} [${sizeOriginal}] > ${transformOut} [${sizeTransformed}] (${Math.round(
            100 - (sizeKBTransformed / sizeKBOriginal) * 100
          )}%)`
          file = transformOut
        }
        resolve()

        const filePath = getRelativeFilePath(file)
        const data = fs.readFileSync(file)
        const arrayBuffer = toArrayBuffer(data)
        gltfLoader.parse(
          arrayBuffer,
          '',
          async (gltf) => {        
            stream.write(await parse(gltf, { fileName: filePath, size, ...options }))
            stream.end()
            resolve()
          },
          (reason) => {
            console.log(reason)
          }
        )
      }
    })
  })
}
