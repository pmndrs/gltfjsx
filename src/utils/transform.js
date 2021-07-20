const { NodeIO } = require('@gltf-transform/core')
const { dedup, resample, prune, textureResize } = require('@gltf-transform/functions')
const { DracoMeshCompression, KHRONOS_EXTENSIONS } = require('@gltf-transform/extensions')
const draco3d = require('draco3dgltf')

async function transform(file, output, config = {}) {
  const io = new NodeIO().registerExtensions([DracoMeshCompression, ...KHRONOS_EXTENSIONS]).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  })

  const document = io.read(file)

  await document.transform(
    // Remove duplicate vertex or texture data, if any.
    dedup(),
    // Losslessly resample animation frames.
    resample(),
    // Remove unused nodes, textures, or other data.
    prune(),
    // Resize all textures to ≤1K.
    textureResize({ size: [1024, 1024] })
  )

  // Add Draco compression.
  document.createExtension(DracoMeshCompression).setRequired(true).setEncoderOptions({
    method: DracoMeshCompression.EncoderMethod.EDGEBREAKER,
  })

  io.write(output, document)
}

module.exports = transform
