import { NodeIO } from '@gltf-transform/core'
import { simplify, weld, dedup, resample, prune, textureCompress, draco } from '@gltf-transform/functions'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
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
    // Losslessly resample animation frames.
    resample(),
    // Remove duplicate vertex or texture data, if any.
    dedup(),
    // Remove unused nodes, textures, or other data.
    prune(),
    // Resize and convert textures (using webp and sharp)
    textureCompress({ targetFormat: 'webp', encoder: sharp, resize: [resolution, resolution] }),
    // Add Draco compression.
    draco(),
  ]

  if (config.simplify) {
    functions.push(
      // Weld vertices
      weld({ tolerance: config.weld ?? 0.0001 }),
      // Simplify meshes
      simplify({ simplifier: MeshoptSimplifier, ratio: config.ratio ?? 0.75, error: config.error ?? 0.001 })
    )
  }

  await document.transform(...functions)

  await io.write(output, document)
}

export default transform
