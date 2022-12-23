import { NodeIO } from '@gltf-transform/core'
import { dedup, resample, prune, textureResize, textureCompress } from '@gltf-transform/functions'
import sharp from 'sharp'
import { DracoMeshCompression, ALL_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

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

  await document.transform(
    // Remove duplicate vertex or texture data, if any.
    dedup(),
    // Losslessly resample animation frames.
    resample(),
    // Remove unused nodes, textures, or other data.
    prune(),
    // Instance meshes.
    // instance(),
    // Resize all textures to ≤1K.
    textureResize({ size: [1024, 1024] }),
    // Convert textures to WebP
    textureCompress({ codec: 'webp', encoder: sharp, formats: /.*/ })
  )

  // Add Draco compression.
  document.createExtension(DracoMeshCompression).setRequired(true).setEncoderOptions({
    method: DracoMeshCompression.EncoderMethod.EDGEBREAKER,
  })

  await io.write(output, document)
}

export default transform
