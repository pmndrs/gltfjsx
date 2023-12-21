import 'jsdom-global'
import fs from 'fs'
import path from 'path'
import { GLTFLoader } from 'three-stdlib'
import parse from './utils/parser.js'
import transform from './utils/transform.js'
import { DRACOLoader } from 'node-three-gltf'

let gltfLoader
// Use the same CDN as useGLTF for draco
const dracoloader = new DRACOLoader()

gltfLoader = new GLTFLoader().setCrossOrigin('anonymous').setDRACOLoader(dracoloader)

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

  // Mock ProgressEvent in a global context
  global.ProgressEvent = class ProgressEvent {
    constructor(type, eventInitDict) {
      this.type = type
      this.eventInitDict = eventInitDict
    }
  }

  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(output)
    stream.once('open', async (fd) => {
      if (!fs.existsSync(file)) {
        reject(file + ' does not exist.')
      } else {
        let size = ''
        // Process GLTF
        if (options.transform || options.instance || options.instanceall) {
          const { name } = path.parse(file)
          const transformOut = path.join(name + '-transformed.glb')
          await transform(file, transformOut, options)
          const { size: sizeOriginal, sizeKB: sizeKBOriginal } = getFileSize(file)
          const { size: sizeTransformed, sizeKB: sizeKBTransformed } = getFileSize(transformOut)
          size = `${file} [${sizeOriginal}] > ${transformOut} [${sizeTransformed}] (${Math.round(
            100 - (sizeKBTransformed / sizeKBOriginal) * 100
          )}%)`
          file = transformOut
        }
        // resolve()

        const filePath = getRelativeFilePath(file)
        const data = fs.readFileSync(file)
        const arrayBuffer = toArrayBuffer(data)
        gltfLoader.parse(
          arrayBuffer,
          '',
          (gltf) => {
            stream.write(parse(gltf, { fileName: filePath, size, ...options }))
            stream.end()
            resolve()
          },
          (reason) => {
            console.log(reason)
            reject(reason)
          }
        )
      }
    })
  })
}
