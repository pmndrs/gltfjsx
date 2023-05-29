import { NodeIO } from '@gltf-transform/core'
import {
  simplify,
  instance,
  flatten,
  dequantize,
  join,
  weld,
  sparse,
  dedup,
  resample,
  prune,
  textureCompress,
  draco,
} from '@gltf-transform/functions'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { ready as resampleReady, resample as resampleWASM } from 'keyframe-resample'
import draco3d from 'draco3dgltf'
import sharp from 'sharp'

async function transform(file, output, config = {}) {
  await MeshoptDecoder.ready
  await MeshoptEncoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })

  const document = await io.read(file)
  const resolution = config.resolution ?? 1024
  
  const functions = [dedup(), instance({ min: 5 }), flatten(), dequantize()]

  if (!config.keepmeshes) {
    functions.push(join())
  }

  if (config.simplify) {
    functions.push(
      // Weld vertices
      weld({ tolerance: config.weld ?? 0.0001 / 2 }),
      // Simplify meshes
      simplify({ simplifier: MeshoptSimplifier, ratio: config.ratio ?? 0, error: config.error ?? 0.0001 })
    )
  }

  functions.push(
    resample({ ready: resampleReady, resample: resampleWASM }),
    prune({ keepAttributes: false, keepLeaves: false }),
    sparse(),
    textureCompress({
      slots: /^(?!normalTexture).*$/, // exclude normal maps
      encoder: sharp,
      targetFormat: 'webp',
      resize: [resolution, resolution],
    }),
    
    textureCompress({
      slots: /^(?=normalTexture).*$/, // include normal maps
      nearLossless: true,
      encoder: sharp,
      targetFormat: 'webp',
      resize: [resolution, resolution],
    }),
    draco()
  )

  await document.transform(...functions)
  await io.write(output, document)
}

export default transform
