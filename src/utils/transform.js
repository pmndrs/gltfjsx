import { cpus } from 'os'
import { NodeIO } from '@gltf-transform/core'
import { dedup, resample, prune, textureResize, webp } from '@gltf-transform/functions'
import squoosh from '@squoosh/lib'
import { DracoMeshCompression, KHRONOS_EXTENSIONS } from '@gltf-transform/extensions'
import draco3d from 'draco3dgltf'

async function transform(file, output, config = {}) {
  const io = new NodeIO().registerExtensions([DracoMeshCompression, ...KHRONOS_EXTENSIONS]).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  })

  const document = await io.read(file)

  await document.transform(
    // Remove duplicate vertex or texture data, if any.
    dedup(),
    // Losslessly resample animation frames.
    resample(),
    // Remove unused nodes, textures, or other data.
    prune(),
    // Resize all textures to ≤1K.
    textureResize({ size: [1024, 1024] }),
    // Convert textures to WebP
    webp({ squoosh, jobs: cpus().length })
  )

  // Add Draco compression.
  document.createExtension(DracoMeshCompression).setRequired(true).setEncoderOptions({
    method: DracoMeshCompression.EncoderMethod.EDGEBREAKER,
  })

  await io.write(output, document)
}

export default transform
