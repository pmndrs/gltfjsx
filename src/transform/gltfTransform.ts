import { NodeIO, Transform } from '@gltf-transform/core'
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
  simplify,
  sparse,
  textureCompress,
  unpartition,
  weld,
} from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { ready as resampleReady, resample as resampleWASM } from 'keyframe-resample'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

import { TransformOptions } from '../options.js'
import { LogAdapter, resolveSimplifyOptions } from './utils.js'

/**
 * Apply a series of transformations to the GLTF file via the @gltf-transform libraries.
 *
 * @param inFilename - The input filename.
 * @param outFilename - The output filename.
 * @param options - The options to apply.
 * @param additionalTransformations - Additional transformations to apply (if any).
 */
export async function gltfTransform<O extends TransformOptions = TransformOptions>(
  inFilename: string,
  outFilename: string,
  options: Readonly<O>,
  additionalTransformations: Transform[] = [],
) {
  await MeshoptDecoder.ready
  await MeshoptEncoder.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
    'meshopt.decoder': MeshoptDecoder,
    'meshopt.encoder': MeshoptEncoder,
  })

  io.setLogger(new LogAdapter(options.log))

  const document = await io.read(inFilename)
  const resolution = options.resolution ?? 1024
  const normalResolution = Math.max(resolution, 2048)
  const degradeResolution = options.degraderesolution ?? 512
  const transformations = [...additionalTransformations]

  // Removes partitions from the binary payload of a glTF file, so that the asset contains at most one (1) .bin Buffer.
  // This process reverses the changes from a partition transform.
  // @see https://gltf-transform.dev/modules/functions/functions/unpartition
  transformations.push(unpartition())

  // Creates palette textures containing all unique values of scalar Material properties within the scene, then merges materials.
  // @see https://gltf-transform.dev/modules/functions/functions/palette
  if (!options.keepmaterials) {
    transformations.push(palette({ min: 5 }))
  }

  // Optimizes Mesh Primitives for locality of reference.
  // @see https://gltf-transform.dev/modules/functions/functions/reorder
  transformations.push(reorder({ encoder: MeshoptEncoder }))

  // Removes duplicate Accessor, Mesh, Texture, and Material properties.
  // Only accessors in mesh primitives, morph targets, and animation samplers are processed.
  // @see https://gltf-transform.dev/modules/functions/functions/dedup
  transformations.push(dedup())

  // This seems problematic ...
  // instance({ min: 5 }),

  // Flattens the scene graph, leaving Nodes with Meshes, Cameras, and other attachments as direct children of the Scene.
  // Skeletons and their descendants are left in their original Node structure.
  //
  // NOTE: this can cause issues when trying to keep names and find those nodes by name.
  //
  // @see https://gltf-transform.dev/modules/functions/functions/flatten
  if (options.flatten === undefined || options.flatten) {
    transformations.push(flatten())
  }

  // Dequantize Primitives, removing KHR_mesh_quantization if present. Dequantization will increase the size of the mesh on disk
  // and in memory, but may be necessary for compatibility with applications that don't support quantization.
  // @see https://gltf-transform.dev/modules/functions/functions/dequantize
  transformations.push(dequantize())

  // Joins compatible Primitives and reduces draw calls. Primitives are eligible for joining if they are members of the same
  // Mesh or, optionally, attached to sibling Nodes in the scene hierarchy. For best results, apply dedup and flatten first
  // to maximize the number of Primitives that can be joined.
  // @see https://gltf-transform.dev/modules/functions/functions/join
  if (!options.keepmeshes) {
    transformations.push(
      join(), // ...
    )
  }

  // Welds Primitives, merging bitwise identical vertices. When merged and indexed, data is shared more efficiently between
  // vertices. File size can be reduced, and the GPU uses the vertex cache more efficiently.
  // @see https://gltf-transform.dev/modules/functions/functions/weld
  transformations.push(
    // Weld vertices
    weld(),
  )

  // Simplification algorithm, based on meshoptimizer, producing meshes with fewer triangles and vertices. Simplification is
  // lossy, but the algorithm aims to preserve visual quality as much as possible for given parameters.
  // @see https://gltf-transform.dev/modules/functions/functions/simplify
  if (options.simplify !== undefined) {
    transformations.push(
      // Simplify meshes
      simplify(resolveSimplifyOptions(options.simplify)),
    )
  }

  transformations.push(
    // Resample AnimationChannels, losslessly deduplicating keyframes to reduce file size.
    // @see https://gltf-transform.dev/modules/functions/functions/resample
    resample({ ready: resampleReady, resample: resampleWASM }),
    // Removes properties from the file if they are not referenced by a Scene. Commonly helpful for cleaning up after other operations
    // @see https://gltf-transform.dev/modules/functions/functions/prune
    prune({ keepAttributes: options.keepattributes ?? false, keepLeaves: false }),
    // Scans all Accessors in the Document, detecting whether each Accessor would benefit from sparse data storage.
    // @see https://gltf-transform.dev/modules/functions/functions/sparse
    sparse(),
  )

  // Convert textures to the `format` e.g. webp (Requires glTF Transform v3 and Node.js).
  // @see https://gltf-transform.dev/modules/functions/functions/textureCompress
  if (options.degrade) {
    // Custom per-file resolution
    transformations.push(
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
    transformations.push(
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

  // Applies Draco compression using KHR_draco_mesh_compression. This type of compression can reduce the size of triangle geometry.
  // @see https://gltf-transform.dev/modules/functions/functions/draco
  transformations.push(draco())

  // Execute the transformations.
  await document.transform(...transformations)
  await io.write(outFilename, document)
}
