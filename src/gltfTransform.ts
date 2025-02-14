import { Logger, NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import {
  dedup,
  dequantize,
  draco,
  flatten,
  join,
  palette,
  prune,
  reorder,
  resample,
  simplify as simplifyFn,
  SimplifyOptions,
  sparse,
  textureCompress,
  unpartition,
  weld,
} from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { ready as resampleReady, resample as resampleWASM } from 'keyframe-resample'
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

import { TransformOptions } from './options.js'

/**
 * If transform is true, apply a series of transformations to the GLTF file via the @gltf-transform libraries.
 */
async function gltfTransform<O extends TransformOptions = TransformOptions>(
  inFilename: string,
  outFilename: string,
  o: Readonly<O>,
) {
  const { simplify, ...options } = o
  await MeshoptDecoder.ready
  await MeshoptEncoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })
  if (options.console) io.setLogger(new Logger(Logger.Verbosity.ERROR))
  else io.setLogger(new Logger(Logger.Verbosity.WARN))

  const document = await io.read(inFilename)
  const resolution = options.resolution ?? 1024
  const normalResolution = Math.max(resolution, 2048)
  const degradeResolution = options.degraderesolution ?? 512
  const functions = [unpartition()]

  if (!options.keepmaterials) functions.push(palette({ min: 5 }))

  functions.push(
    reorder({ encoder: MeshoptEncoder }),
    dedup(),
    // This seems problematic ...
    // instance({ min: 5 }),
    flatten(),
    dequantize(), // ...
  )

  if (!options.keepmeshes) {
    functions.push(
      join(), // ...
    )
  }

  functions.push(
    // Weld vertices
    weld(),
  )

  if (simplify !== false && simplify !== undefined) {
    let simplifyOptions: SimplifyOptions = { simplifier: MeshoptSimplifier }
    if (typeof simplify === 'boolean') {
      simplifyOptions = {
        ...simplifyOptions,
        ratio: 0.75, // sync with cli defaults if changed
        error: 0.001,
      }
    } else {
      simplifyOptions = {
        ...simplifyOptions,
        ...simplify,
      }
    }
    functions.push(
      // Simplify meshes
      simplifyFn(simplifyOptions),
    )
  }

  functions.push(
    resample({ ready: resampleReady, resample: resampleWASM }),
    prune({ keepAttributes: options.keepattributes ?? false, keepLeaves: false }),
    sparse(),
  )

  if (options.degrade) {
    // Custom per-file resolution
    functions.push(
      textureCompress({
        encoder: sharp,
        pattern: new RegExp(`^(?=${options.degrade}).*$`),
        targetFormat: options.format,
        resize: [degradeResolution, degradeResolution],
      }),
      textureCompress({
        encoder: sharp,
        pattern: new RegExp(`^(?!${options.degrade}).*$`),
        targetFormat: options.format,
        resize: [resolution, resolution],
      }),
    )
  } else {
    // Keep normal maps near lossless
    functions.push(
      textureCompress({
        slots: /^(?!normalTexture).*$/, // exclude normal maps
        encoder: sharp,
        targetFormat: options.format,
        resize: [resolution, resolution],
      }),
      textureCompress({
        slots: /^(?=normalTexture).*$/, // include normal maps
        encoder: sharp,
        targetFormat: 'jpeg',
        resize: [normalResolution, normalResolution],
      }),
    )
  }

  functions.push(draco())

  await document.transform(...functions)
  await io.write(outFilename, document)
}

export default gltfTransform
