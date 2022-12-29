import { NodeIO } from '@gltf-transform/core'
import { simplify, weld, dedup, resample, prune, textureResize, textureCompress } from '@gltf-transform/functions'
import { DracoMeshCompression, ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
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

  const functions = [
    // Remove duplicate vertex or texture data, if any.
    dedup(),
    // Losslessly resample animation frames.
    resample(),
    // Remove unused nodes, textures, or other data.
    prune(),
    // Instance meshes.
    // instance(),
    // Resize all textures to ≤1K.
    textureResize({ size: [resolution, resolution] }),
    // Convert textures to WebP
    textureCompress({ codec: 'webp', encoder: sharp, formats: /.*/ }),
  ]

  if (config.simplify) {
    functions.push(
      // Weld vertices
      weld({ tolerance: 0.0001 }),
      // Simplify meshes
      simplify({ simplifier: MeshoptSimplifier, ratio: 0.75, error: 0.001 })
    )
  }

  await document.transform(...functions)

  // Add Draco compression.
  document.createExtension(DracoMeshCompression).setRequired(true).setEncoderOptions({
    method: DracoMeshCompression.EncoderMethod.EDGEBREAKER,
  })

  await io.write(output, document)
}

export default transform
