import * as THREE from 'three'

export class GLTFLoader extends THREE.Loader {
  constructor() {
    super()
    this.dracoLoader = null
    this.ddsLoader = null
    this.ktx2Loader = null

    this.pluginCallbacks = []

    this.register(function (parser) {
      return new GLTFMaterialsClearcoatExtension(parser)
    })

    this.register(function (parser) {
      return new GLTFTextureBasisUExtension(parser)
    })

    this.register(function (parser) {
      return new GLTFMaterialsTransmissionExtension(parser)
    })

    this.register(function (parser) {
      return new GLTFLightsExtension(parser)
    })
    this.register(function (parser) {
      return new GLTFMeshGpuInstancing(parser)
    })
  }

  load(url, onLoad, onProgress, onError) {
    var scope = this

    var resourcePath

    if (this.resourcePath !== '') {
      resourcePath = this.resourcePath
    } else if (this.path !== '') {
      resourcePath = this.path
    } else {
      resourcePath = THREE.LoaderUtils.extractUrlBase(url)
    }

    // Tells the LoadingManager to track an extra item, which resolves after
    // the model is fully loaded. This means the count of items loaded will
    // be incorrect, but ensures manager.onLoad() does not fire early.
    this.manager.itemStart(url)

    var _onError = function (e) {
      if (onError) {
        onError(e)
      } else {
        console.error(e)
      }

      scope.manager.itemError(url)
      scope.manager.itemEnd(url)
    }

    var loader = new THREE.FileLoader(this.manager)

    loader.setPath(this.path)
    loader.setResponseType('arraybuffer')
    loader.setRequestHeader(this.requestHeader)
    loader.setWithCredentials(this.withCredentials)

    loader.load(
      url,
      function (data) {
        try {
          scope.parse(
            data,
            resourcePath,
            function (gltf) {
              onLoad(gltf)

              scope.manager.itemEnd(url)
            },
            _onError
          )
        } catch (e) {
          _onError(e)
        }
      },
      onProgress,
      _onError
    )
  }

  setDRACOLoader(dracoLoader) {
    this.dracoLoader = dracoLoader
    return this
  }

  setDDSLoader(ddsLoader) {
    this.ddsLoader = ddsLoader
    return this
  }

  setKTX2Loader(ktx2Loader) {
    this.ktx2Loader = ktx2Loader
    return this
  }

  register(callback) {
    if (this.pluginCallbacks.indexOf(callback) === -1) {
      this.pluginCallbacks.push(callback)
    }

    return this
  }

  unregister(callback) {
    if (this.pluginCallbacks.indexOf(callback) !== -1) {
      this.pluginCallbacks.splice(this.pluginCallbacks.indexOf(callback), 1)
    }

    return this
  }

  parse(data, path, onLoad, onError) {
    var content
    var extensions = {}
    var plugins = {}

    if (typeof data === 'string') {
      content = data
    } else {
      var magic = THREE.LoaderUtils.decodeText(new Uint8Array(data, 0, 4))

      if (magic === BINARY_EXTENSION_HEADER_MAGIC) {
        try {
          extensions[EXTENSIONS.KHR_BINARY_GLTF] = new GLTFBinaryExtension(data)
        } catch (error) {
          if (onError) onError(error)
          return
        }

        content = extensions[EXTENSIONS.KHR_BINARY_GLTF].content
      } else {
        content = THREE.LoaderUtils.decodeText(new Uint8Array(data))
      }
    }

    var json = JSON.parse(content)

    if (json.asset === undefined || json.asset.version[0] < 2) {
      if (onError) onError(new Error('THREE.GLTFLoader: Unsupported asset. glTF versions >=2.0 are supported.'))
      return
    }

    var parser = new GLTFParser(json, {
      path: path || this.resourcePath || '',
      crossOrigin: this.crossOrigin,
      manager: this.manager,
      ktx2Loader: this.ktx2Loader,
    })

    parser.fileLoader.setRequestHeader(this.requestHeader)

    for (var i = 0; i < this.pluginCallbacks.length; i++) {
      var plugin = this.pluginCallbacks[i](parser)
      plugins[plugin.name] = plugin

      // Workaround to avoid determining as unknown extension
      // in addUnknownExtensionsToUserData().
      // Remove this workaround if we move all the existing
      // extension handlers to plugin system
      extensions[plugin.name] = true
    }

    if (json.extensionsUsed) {
      for (var i = 0; i < json.extensionsUsed.length; ++i) {
        var extensionName = json.extensionsUsed[i]
        var extensionsRequired = json.extensionsRequired || []

        switch (extensionName) {
          case EXTENSIONS.KHR_MATERIALS_UNLIT:
            extensions[extensionName] = new GLTFMaterialsUnlitExtension()
            break

          case EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS:
            extensions[extensionName] = new GLTFMaterialsPbrSpecularGlossinessExtension()
            break

          case EXTENSIONS.KHR_DRACO_MESH_COMPRESSION:
            extensions[extensionName] = new GLTFDracoMeshCompressionExtension(json, this.dracoLoader)
            break

          case EXTENSIONS.MSFT_TEXTURE_DDS:
            extensions[extensionName] = new GLTFTextureDDSExtension(this.ddsLoader)
            break

          case EXTENSIONS.KHR_TEXTURE_TRANSFORM:
            extensions[extensionName] = new GLTFTextureTransformExtension()
            break

          case EXTENSIONS.KHR_MESH_QUANTIZATION:
            extensions[extensionName] = new GLTFMeshQuantizationExtension()
            break

          default:
            if (extensionsRequired.indexOf(extensionName) >= 0 && plugins[extensionName] === undefined) {
              // console.warn('THREE.GLTFLoader: Unknown extension "' + extensionName + '".')
            }
        }
      }
    }

    parser.setExtensions(extensions)
    parser.setPlugins(plugins)
    parser.parse(onLoad, onError)
  }
}

/* GLTFREGISTRY */

function GLTFRegistry() {
  var objects = {}

  return {
    get: function (key) {
      return objects[key]
    },

    add: function (key, object) {
      objects[key] = object
    },

    remove: function (key) {
      delete objects[key]
    },

    removeAll: function () {
      objects = {}
    },
  }
}

/*********************************/
/********** EXTENSIONS ***********/
/*********************************/

var EXTENSIONS = {
  KHR_BINARY_GLTF: 'KHR_binary_glTF',
  KHR_DRACO_MESH_COMPRESSION: 'KHR_draco_mesh_compression',
  KHR_LIGHTS_PUNCTUAL: 'KHR_lights_punctual',
  KHR_MATERIALS_CLEARCOAT: 'KHR_materials_clearcoat',
  KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS: 'KHR_materials_pbrSpecularGlossiness',
  KHR_MATERIALS_TRANSMISSION: 'KHR_materials_transmission',
  KHR_MATERIALS_UNLIT: 'KHR_materials_unlit',
  KHR_TEXTURE_BASISU: 'KHR_texture_basisu',
  KHR_TEXTURE_TRANSFORM: 'KHR_texture_transform',
  KHR_MESH_QUANTIZATION: 'KHR_mesh_quantization',
  MSFT_TEXTURE_DDS: 'MSFT_texture_dds',
  EXT_MESH_GPU_INSTANCING: 'EXT_mesh_gpu_instancing',
}

/**
 * DDS Texture Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/MSFT_texture_dds
 *
 */
function GLTFTextureDDSExtension(ddsLoader) {
  if (!ddsLoader) {
    throw new Error('THREE.GLTFLoader: Attempting to load .dds texture without importing THREE.DDSLoader')
  }

  this.name = EXTENSIONS.MSFT_TEXTURE_DDS
  this.ddsLoader = ddsLoader
}

/**
 * Punctual Lights Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_lights_punctual
 */
function GLTFLightsExtension(parser) {
  this.parser = parser
  this.name = EXTENSIONS.KHR_LIGHTS_PUNCTUAL

  // Object3D instance caches
  this.cache = { refs: {}, uses: {} }
}

GLTFLightsExtension.prototype._markDefs = function () {
  var parser = this.parser
  var nodeDefs = this.parser.json.nodes || []

  for (var nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
    var nodeDef = nodeDefs[nodeIndex]

    if (nodeDef.extensions && nodeDef.extensions[this.name] && nodeDef.extensions[this.name].light !== undefined) {
      parser._addNodeRef(this.cache, nodeDef.extensions[this.name].light)
    }
  }
}

GLTFLightsExtension.prototype._loadLight = function (lightIndex) {
  var parser = this.parser
  var cacheKey = 'light:' + lightIndex
  var dependency = parser.cache.get(cacheKey)

  if (dependency) return dependency

  var json = parser.json
  var extensions = (json.extensions && json.extensions[this.name]) || {}
  var lightDefs = extensions.lights || []
  var lightDef = lightDefs[lightIndex]
  var lightNode

  var color = new THREE.Color(0xffffff)

  if (lightDef.color !== undefined) color.fromArray(lightDef.color)

  var range = lightDef.range !== undefined ? lightDef.range : 0

  switch (lightDef.type) {
    case 'directional':
      lightNode = new THREE.DirectionalLight(color)
      lightNode.target.position.set(0, 0, -1)
      lightNode.add(lightNode.target)
      break

    case 'point':
      lightNode = new THREE.PointLight(color)
      lightNode.distance = range
      break

    case 'spot':
      lightNode = new THREE.SpotLight(color)
      lightNode.distance = range
      // Handle spotlight properties.
      lightDef.spot = lightDef.spot || {}
      lightDef.spot.innerConeAngle = lightDef.spot.innerConeAngle !== undefined ? lightDef.spot.innerConeAngle : 0
      lightDef.spot.outerConeAngle =
        lightDef.spot.outerConeAngle !== undefined ? lightDef.spot.outerConeAngle : Math.PI / 4.0
      lightNode.angle = lightDef.spot.outerConeAngle
      lightNode.penumbra = 1.0 - lightDef.spot.innerConeAngle / lightDef.spot.outerConeAngle
      lightNode.target.position.set(0, 0, -1)
      lightNode.add(lightNode.target)
      break

    default:
      throw new Error('THREE.GLTFLoader: Unexpected light type, "' + lightDef.type + '".')
  }

  // Some lights (e.g. spot) default to a position other than the origin. Reset the position
  // here, because node-level parsing will only override position if explicitly specified.
  lightNode.position.set(0, 0, 0)

  lightNode.decay = 2

  if (lightDef.intensity !== undefined) lightNode.intensity = lightDef.intensity

  lightNode.name = parser.createUniqueName(lightDef.name || 'light_' + lightIndex)

  dependency = Promise.resolve(lightNode)

  parser.cache.add(cacheKey, dependency)

  return dependency
}

GLTFLightsExtension.prototype.createNodeAttachment = function (nodeIndex) {
  var self = this
  var parser = this.parser
  var json = parser.json
  var nodeDef = json.nodes[nodeIndex]
  var lightDef = (nodeDef.extensions && nodeDef.extensions[this.name]) || {}
  var lightIndex = lightDef.light

  if (lightIndex === undefined) return null

  return this._loadLight(lightIndex).then(function (light) {
    return parser._getNodeRef(self.cache, lightIndex, light)
  })
}

/**
 * Unlit Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_unlit
 */
function GLTFMaterialsUnlitExtension() {
  this.name = EXTENSIONS.KHR_MATERIALS_UNLIT
}

GLTFMaterialsUnlitExtension.prototype.getMaterialType = function () {
  return THREE.MeshBasicMaterial
}

GLTFMaterialsUnlitExtension.prototype.extendParams = function (materialParams, materialDef, parser) {
  var pending = []

  materialParams.color = new THREE.Color(1.0, 1.0, 1.0)
  materialParams.opacity = 1.0

  var metallicRoughness = materialDef.pbrMetallicRoughness

  if (metallicRoughness) {
    if (Array.isArray(metallicRoughness.baseColorFactor)) {
      var array = metallicRoughness.baseColorFactor

      materialParams.color.fromArray(array)
      materialParams.opacity = array[3]
    }
  }

  return Promise.all(pending)
}

/**
 * Clearcoat Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_clearcoat
 */
function GLTFMaterialsClearcoatExtension(parser) {
  this.parser = parser
  this.name = EXTENSIONS.KHR_MATERIALS_CLEARCOAT
}

GLTFMaterialsClearcoatExtension.prototype.getMaterialType = function (materialIndex) {
  var parser = this.parser
  var materialDef = parser.json.materials[materialIndex]

  if (!materialDef.extensions || !materialDef.extensions[this.name]) return null

  return THREE.MeshPhysicalMaterial
}

GLTFMaterialsClearcoatExtension.prototype.extendMaterialParams = function (materialIndex, materialParams) {
  var parser = this.parser
  var materialDef = parser.json.materials[materialIndex]

  if (!materialDef.extensions || !materialDef.extensions[this.name]) {
    return Promise.resolve()
  }

  var pending = []

  var extension = materialDef.extensions[this.name]

  if (extension.clearcoatFactor !== undefined) {
    materialParams.clearcoat = extension.clearcoatFactor
  }

  if (extension.clearcoatRoughnessFactor !== undefined) {
    materialParams.clearcoatRoughness = extension.clearcoatRoughnessFactor
  }

  if (extension.clearcoatNormalTexture !== undefined) {
    if (extension.clearcoatNormalTexture.scale !== undefined) {
      var scale = extension.clearcoatNormalTexture.scale
      materialParams.clearcoatNormalScale = new THREE.Vector2(scale, scale)
    }
  }

  return Promise.all(pending)
}

/**
 * Transmission Materials Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_transmission
 * Draft: https://github.com/KhronosGroup/glTF/pull/1698
 */
function GLTFMaterialsTransmissionExtension(parser) {
  this.parser = parser
  this.name = EXTENSIONS.KHR_MATERIALS_TRANSMISSION
}

GLTFMaterialsTransmissionExtension.prototype.getMaterialType = function (materialIndex) {
  var parser = this.parser
  var materialDef = parser.json.materials[materialIndex]

  if (!materialDef.extensions || !materialDef.extensions[this.name]) return null

  return THREE.MeshPhysicalMaterial
}

GLTFMaterialsTransmissionExtension.prototype.extendMaterialParams = function (materialIndex, materialParams) {
  var parser = this.parser
  var materialDef = parser.json.materials[materialIndex]

  if (!materialDef.extensions || !materialDef.extensions[this.name]) {
    return Promise.resolve()
  }

  var pending = []

  var extension = materialDef.extensions[this.name]

  if (extension.transmissionFactor !== undefined) {
    materialParams.transmission = extension.transmissionFactor
  }

  return Promise.all(pending)
}

/**
 * BasisU Texture Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_basisu
 * (draft PR https://github.com/KhronosGroup/glTF/pull/1751)
 */
function GLTFTextureBasisUExtension(parser) {
  this.parser = parser
  this.name = EXTENSIONS.KHR_TEXTURE_BASISU
}

GLTFTextureBasisUExtension.prototype.loadTexture = function (textureIndex) {
  return Promise.resolve(new THREE.Texture())
}

/**
 * GPU Instancing Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Vendor/EXT_mesh_gpu_instancing
 *
 */
class GLTFMeshGpuInstancing {
  constructor(parser) {
    this.name = EXTENSIONS.EXT_MESH_GPU_INSTANCING
    this.parser = parser
  }

  createNodeMesh(nodeIndex) {
    const json = this.parser.json
    const nodeDef = json.nodes[nodeIndex]

    if (!nodeDef.extensions || !nodeDef.extensions[this.name] || nodeDef.mesh === undefined) {
      return null
    }

    const meshDef = json.meshes[nodeDef.mesh]

    // No Points or Lines + Instancing support yet
    for (const primitive of meshDef.primitives) {
      if (
        primitive.mode !== WEBGL_CONSTANTS.TRIANGLES &&
        primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_STRIP &&
        primitive.mode !== WEBGL_CONSTANTS.TRIANGLE_FAN &&
        primitive.mode !== undefined
      ) {
        return null
      }
    }

    const extensionDef = nodeDef.extensions[this.name]
    const attributesDef = extensionDef.attributes
    // @TODO: Can we support InstancedMesh + SkinnedMesh?
    const pending = []
    const attributes = {}

    for (const key in attributesDef) {
      pending.push(
        this.parser.getDependency('accessor', attributesDef[key]).then((accessor) => {
          attributes[key] = accessor
          return attributes[key]
        })
      )
    }
    if (pending.length < 1) {
      return null
    }
    pending.push(this.parser.createNodeMesh(nodeIndex))

    return Promise.all(pending).then((results) => {
      const nodeObject = results.pop()
      const meshes = nodeObject.isGroup ? nodeObject.children : [nodeObject]
      const count = results[0].count // All attribute counts should be same

      const instancedMeshes = []
      for (const mesh of meshes) {
        // Temporal variables
        const m = new THREE.Matrix4()
        const p = new THREE.Vector3()
        const q = new THREE.Quaternion()
        const s = new THREE.Vector3(1, 1, 1)
        const instancedMesh = new THREE.InstancedMesh(mesh.geometry, mesh.material, count)

        for (let i = 0; i < count; i++) {
          if (attributes.TRANSLATION) {
            p.fromBufferAttribute(attributes.TRANSLATION, i)
          }
          if (attributes.ROTATION) {
            q.fromBufferAttribute(attributes.ROTATION, i)
          }
          if (attributes.SCALE) {
            s.fromBufferAttribute(attributes.SCALE, i)
          }
          instancedMesh.setMatrixAt(i, m.compose(p, q, s))
        }

        // Add instance attributes to the geometry, excluding TRS.
        for (const attributeName in attributes) {
          if (attributeName !== 'TRANSLATION' && attributeName !== 'ROTATION' && attributeName !== 'SCALE') {
            mesh.geometry.setAttribute(attributeName, attributes[attributeName])
          }
        }

        // Just in case
        THREE.Object3D.prototype.copy.call(instancedMesh, mesh)
        this.parser.assignFinalMaterial(instancedMesh)
        instancedMeshes.push(instancedMesh)
      }
      if (nodeObject.isGroup) {
        nodeObject.clear()
        nodeObject.add(...instancedMeshes)
        return nodeObject
      }
      return instancedMeshes[0]
    })
  }
}

/* BINARY EXTENSION */
var BINARY_EXTENSION_HEADER_MAGIC = 'glTF'
var BINARY_EXTENSION_HEADER_LENGTH = 12
var BINARY_EXTENSION_CHUNK_TYPES = { JSON: 0x4e4f534a, BIN: 0x004e4942 }

function GLTFBinaryExtension(data) {
  this.name = EXTENSIONS.KHR_BINARY_GLTF
  this.content = null
  this.body = null

  var headerView = new DataView(data, 0, BINARY_EXTENSION_HEADER_LENGTH)

  this.header = {
    magic: THREE.LoaderUtils.decodeText(new Uint8Array(data.slice(0, 4))),
    version: headerView.getUint32(4, true),
    length: headerView.getUint32(8, true),
  }

  if (this.header.magic !== BINARY_EXTENSION_HEADER_MAGIC) {
    throw new Error('THREE.GLTFLoader: Unsupported glTF-Binary header.')
  } else if (this.header.version < 2.0) {
    throw new Error('THREE.GLTFLoader: Legacy binary file detected.')
  }

  var chunkView = new DataView(data, BINARY_EXTENSION_HEADER_LENGTH)
  var chunkIndex = 0

  while (chunkIndex < chunkView.byteLength) {
    var chunkLength = chunkView.getUint32(chunkIndex, true)
    chunkIndex += 4

    var chunkType = chunkView.getUint32(chunkIndex, true)
    chunkIndex += 4

    if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.JSON) {
      var contentArray = new Uint8Array(data, BINARY_EXTENSION_HEADER_LENGTH + chunkIndex, chunkLength)
      this.content = THREE.LoaderUtils.decodeText(contentArray)
    } else if (chunkType === BINARY_EXTENSION_CHUNK_TYPES.BIN) {
      var byteOffset = BINARY_EXTENSION_HEADER_LENGTH + chunkIndex
      this.body = data.slice(byteOffset, byteOffset + chunkLength)
    }

    // Clients must ignore chunks with unknown types.

    chunkIndex += chunkLength
  }

  if (this.content === null) {
    throw new Error('THREE.GLTFLoader: JSON content not found.')
  }
}

/**
 * DRACO Mesh Compression Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_draco_mesh_compression
 */
function GLTFDracoMeshCompressionExtension(json, dracoLoader) {
  if (!dracoLoader) {
    throw new Error('THREE.GLTFLoader: No DRACOLoader instance provided.')
  }

  this.name = EXTENSIONS.KHR_DRACO_MESH_COMPRESSION
  this.json = json
  this.dracoLoader = dracoLoader
}

GLTFDracoMeshCompressionExtension.prototype.decodePrimitive = function (primitive, parser) {
  var json = this.json
  var dracoLoader = this.dracoLoader
  var bufferViewIndex = primitive.extensions[this.name].bufferView
  var gltfAttributeMap = primitive.extensions[this.name].attributes
  var threeAttributeMap = {}
  var attributeNormalizedMap = {}
  var attributeTypeMap = {}

  for (var attributeName in gltfAttributeMap) {
    var threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase()

    threeAttributeMap[threeAttributeName] = gltfAttributeMap[attributeName]
  }

  for (attributeName in primitive.attributes) {
    var threeAttributeName = ATTRIBUTES[attributeName] || attributeName.toLowerCase()

    if (gltfAttributeMap[attributeName] !== undefined) {
      var accessorDef = json.accessors[primitive.attributes[attributeName]]
      var componentType = WEBGL_COMPONENT_TYPES[accessorDef.componentType]

      attributeTypeMap[threeAttributeName] = componentType
      attributeNormalizedMap[threeAttributeName] = accessorDef.normalized === true
    }
  }

  return parser.getDependency('bufferView', bufferViewIndex).then(function (bufferView) {
    return new Promise(function (resolve) {
      dracoLoader.decodeDracoFile(
        bufferView,
        function (geometry) {
          for (var attributeName in geometry.attributes) {
            var attribute = geometry.attributes[attributeName]
            var normalized = attributeNormalizedMap[attributeName]

            if (normalized !== undefined) attribute.normalized = normalized
          }

          resolve(geometry)
        },
        threeAttributeMap,
        attributeTypeMap
      )
    })
  })
}

/**
 * Texture Transform Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_texture_transform
 */
function GLTFTextureTransformExtension() {
  this.name = EXTENSIONS.KHR_TEXTURE_TRANSFORM
}

GLTFTextureTransformExtension.prototype.extendTexture = function (texture, transform) {
  texture = texture.clone()

  if (transform.offset !== undefined) {
    texture.offset.fromArray(transform.offset)
  }

  if (transform.rotation !== undefined) {
    texture.rotation = transform.rotation
  }

  if (transform.scale !== undefined) {
    texture.repeat.fromArray(transform.scale)
  }

  if (transform.texCoord !== undefined) {
    console.warn('THREE.GLTFLoader: Custom UV sets in "' + this.name + '" extension not yet supported.')
  }

  texture.needsUpdate = true

  return texture
}

/**
 * Specular-Glossiness Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_materials_pbrSpecularGlossiness
 */

function GLTFMaterialsPbrSpecularGlossinessExtension() {
  return {
    name: EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS,

    specularGlossinessParams: [
      'color',
      'map',
      'lightMap',
      'lightMapIntensity',
      'aoMap',
      'aoMapIntensity',
      'emissive',
      'emissiveIntensity',
      'emissiveMap',
      'bumpMap',
      'bumpScale',
      'normalMap',
      'normalMapType',
      'displacementMap',
      'displacementScale',
      'displacementBias',
      'specularMap',
      'specular',
      'glossinessMap',
      'glossiness',
      'alphaMap',
      'envMap',
      'envMapIntensity',
      'refractionRatio',
    ],

    getMaterialType: function () {
      return THREE.MeshStandardMaterial
    },

    extendParams: function (materialParams, materialDef, parser) {
      var pbrSpecularGlossiness = materialDef.extensions[this.name]

      materialParams.color = new THREE.Color(1.0, 1.0, 1.0)
      materialParams.opacity = 1.0

      var pending = []

      if (Array.isArray(pbrSpecularGlossiness.diffuseFactor)) {
        var array = pbrSpecularGlossiness.diffuseFactor

        materialParams.color.fromArray(array)
        materialParams.opacity = array[3]
      }

      materialParams.emissive = new THREE.Color(0.0, 0.0, 0.0)
      materialParams.glossiness =
        pbrSpecularGlossiness.glossinessFactor !== undefined ? pbrSpecularGlossiness.glossinessFactor : 1.0
      materialParams.specular = new THREE.Color(1.0, 1.0, 1.0)

      if (Array.isArray(pbrSpecularGlossiness.specularFactor)) {
        materialParams.specular.fromArray(pbrSpecularGlossiness.specularFactor)
      }

      return Promise.all(pending)
    },

    createMaterial: function (materialParams) {
      var material = new THREE.MeshStandardMaterial(materialParams)
      material.fog = true

      material.color = materialParams.color

      material.map = materialParams.map === undefined ? null : materialParams.map

      material.lightMap = null
      material.lightMapIntensity = 1.0

      material.aoMap = materialParams.aoMap === undefined ? null : materialParams.aoMap
      material.aoMapIntensity = 1.0

      material.emissive = materialParams.emissive
      material.emissiveIntensity = 1.0
      material.emissiveMap = materialParams.emissiveMap === undefined ? null : materialParams.emissiveMap

      material.bumpMap = materialParams.bumpMap === undefined ? null : materialParams.bumpMap
      material.bumpScale = 1

      material.normalMap = materialParams.normalMap === undefined ? null : materialParams.normalMap
      material.normalMapType = THREE.TangentSpaceNormalMap

      if (materialParams.normalScale) material.normalScale = materialParams.normalScale

      material.displacementMap = null
      material.displacementScale = 1
      material.displacementBias = 0

      material.specularMap = materialParams.specularMap === undefined ? null : materialParams.specularMap
      material.specular = materialParams.specular

      material.glossinessMap = materialParams.glossinessMap === undefined ? null : materialParams.glossinessMap
      material.glossiness = materialParams.glossiness

      material.alphaMap = null

      material.envMap = materialParams.envMap === undefined ? null : materialParams.envMap
      material.envMapIntensity = 1.0

      material.refractionRatio = 0.98

      return material
    },
  }
}

/**
 * Mesh Quantization Extension
 *
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/extensions/2.0/Khronos/KHR_mesh_quantization
 */
function GLTFMeshQuantizationExtension() {
  this.name = EXTENSIONS.KHR_MESH_QUANTIZATION
}

/*********************************/
/********** INTERPOLATION ********/
/*********************************/

// Spline Interpolation
// Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#appendix-c-spline-interpolation
function GLTFCubicSplineInterpolant(parameterPositions, sampleValues, sampleSize, resultBuffer) {
  THREE.Interpolant.call(this, parameterPositions, sampleValues, sampleSize, resultBuffer)
}

GLTFCubicSplineInterpolant.prototype = Object.create(THREE.Interpolant.prototype)
GLTFCubicSplineInterpolant.prototype.constructor = GLTFCubicSplineInterpolant

GLTFCubicSplineInterpolant.prototype.copySampleValue_ = function (index) {
  // Copies a sample value to the result buffer. See description of glTF
  // CUBICSPLINE values layout in interpolate_() function below.

  var result = this.resultBuffer,
    values = this.sampleValues,
    valueSize = this.valueSize,
    offset = index * valueSize * 3 + valueSize

  for (var i = 0; i !== valueSize; i++) {
    result[i] = values[offset + i]
  }

  return result
}

GLTFCubicSplineInterpolant.prototype.beforeStart_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_

GLTFCubicSplineInterpolant.prototype.afterEnd_ = GLTFCubicSplineInterpolant.prototype.copySampleValue_

GLTFCubicSplineInterpolant.prototype.interpolate_ = function (i1, t0, t, t1) {
  var result = this.resultBuffer
  var values = this.sampleValues
  var stride = this.valueSize

  var stride2 = stride * 2
  var stride3 = stride * 3

  var td = t1 - t0

  var p = (t - t0) / td
  var pp = p * p
  var ppp = pp * p

  var offset1 = i1 * stride3
  var offset0 = offset1 - stride3

  var s2 = -2 * ppp + 3 * pp
  var s3 = ppp - pp
  var s0 = 1 - s2
  var s1 = s3 - pp + p

  // Layout of keyframe output values for CUBICSPLINE animations:
  //   [ inTangent_1, splineVertex_1, outTangent_1, inTangent_2, splineVertex_2, ... ]
  for (var i = 0; i !== stride; i++) {
    var p0 = values[offset0 + i + stride] // splineVertex_k
    var m0 = values[offset0 + i + stride2] * td // outTangent_k * (t_k+1 - t_k)
    var p1 = values[offset1 + i + stride] // splineVertex_k+1
    var m1 = values[offset1 + i] * td // inTangent_k+1 * (t_k+1 - t_k)

    result[i] = s0 * p0 + s1 * m0 + s2 * p1 + s3 * m1
  }

  return result
}

/*********************************/
/********** INTERNALS ************/
/*********************************/

/* CONSTANTS */

var WEBGL_CONSTANTS = {
  FLOAT: 5126,
  //FLOAT_MAT2: 35674,
  FLOAT_MAT3: 35675,
  FLOAT_MAT4: 35676,
  FLOAT_VEC2: 35664,
  FLOAT_VEC3: 35665,
  FLOAT_VEC4: 35666,
  LINEAR: 9729,
  REPEAT: 10497,
  SAMPLER_2D: 35678,
  POINTS: 0,
  LINES: 1,
  LINE_LOOP: 2,
  LINE_STRIP: 3,
  TRIANGLES: 4,
  TRIANGLE_STRIP: 5,
  TRIANGLE_FAN: 6,
  UNSIGNED_BYTE: 5121,
  UNSIGNED_SHORT: 5123,
}

var WEBGL_COMPONENT_TYPES = {
  5120: Int8Array,
  5121: Uint8Array,
  5122: Int16Array,
  5123: Uint16Array,
  5125: Uint32Array,
  5126: Float32Array,
}

var WEBGL_FILTERS = {
  9728: THREE.NearestFilter,
  9729: THREE.LinearFilter,
  9984: THREE.NearestMipmapNearestFilter,
  9985: THREE.LinearMipmapNearestFilter,
  9986: THREE.NearestMipmapLinearFilter,
  9987: THREE.LinearMipmapLinearFilter,
}

var WEBGL_WRAPPINGS = {
  33071: THREE.ClampToEdgeWrapping,
  33648: THREE.MirroredRepeatWrapping,
  10497: THREE.RepeatWrapping,
}

var WEBGL_TYPE_SIZES = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
}

var ATTRIBUTES = {
  POSITION: 'position',
  NORMAL: 'normal',
  TANGENT: 'tangent',
  TEXCOORD_0: 'uv',
  TEXCOORD_1: 'uv2',
  COLOR_0: 'color',
  WEIGHTS_0: 'skinWeight',
  JOINTS_0: 'skinIndex',
}

var PATH_PROPERTIES = {
  scale: 'scale',
  translation: 'position',
  rotation: 'quaternion',
  weights: 'morphTargetInfluences',
}

var INTERPOLATION = {
  CUBICSPLINE: undefined, // We use a custom interpolant (GLTFCubicSplineInterpolation) for CUBICSPLINE tracks. Each
  // keyframe track will be initialized with a default interpolation type, then modified.
  LINEAR: THREE.InterpolateLinear,
  STEP: THREE.InterpolateDiscrete,
}

var ALPHA_MODES = {
  OPAQUE: 'OPAQUE',
  MASK: 'MASK',
  BLEND: 'BLEND',
}

/* UTILITY FUNCTIONS */

function resolveURL(url, path) {
  // Invalid URL
  if (typeof url !== 'string' || url === '') return ''

  // Host Relative URL
  if (/^https?:\/\//i.test(path) && /^\//.test(url)) {
    path = path.replace(/(^https?:\/\/[^\/]+).*/i, '$1')
  }

  // Absolute URL http://,https://,//
  if (/^(https?:)?\/\//i.test(url)) return url

  // Data URI
  if (/^data:.*,.*$/i.test(url)) return url

  // Blob URL
  if (/^blob:.*$/i.test(url)) return url

  // Relative URL
  return path + url
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#default-material
 */
function createDefaultMaterial(cache) {
  if (cache['DefaultMaterial'] === undefined) {
    cache['DefaultMaterial'] = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x000000,
      metalness: 1,
      roughness: 1,
      transparent: false,
      depthTest: true,
      side: THREE.FrontSide,
    })
  }

  return cache['DefaultMaterial']
}

function addUnknownExtensionsToUserData(knownExtensions, object, objectDef) {
  // Add unknown glTF extensions to an object's userData.

  for (var name in objectDef.extensions) {
    if (knownExtensions[name] === undefined) {
      object.userData.gltfExtensions = object.userData.gltfExtensions || {}
      object.userData.gltfExtensions[name] = objectDef.extensions[name]
    }
  }
}

/**
 * @param {THREE.Object3D|THREE.Material|THREE.BufferGeometry} object
 * @param {GLTF.definition} gltfDef
 */
function assignExtrasToUserData(object, gltfDef) {
  if (gltfDef.extras !== undefined) {
    if (typeof gltfDef.extras === 'object') {
      Object.assign(object.userData, gltfDef.extras)
    } else {
      console.warn('THREE.GLTFLoader: Ignoring primitive type .extras, ' + gltfDef.extras)
    }
  }
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#morph-targets
 *
 * @param {THREE.BufferGeometry} geometry
 * @param {Array<GLTF.Target>} targets
 * @param {GLTFParser} parser
 * @return {Promise<THREE.BufferGeometry>}
 */
function addMorphTargets(geometry, targets, parser) {
  var hasMorphPosition = false
  var hasMorphNormal = false

  for (var i = 0, il = targets.length; i < il; i++) {
    var target = targets[i]

    if (target.POSITION !== undefined) hasMorphPosition = true
    if (target.NORMAL !== undefined) hasMorphNormal = true

    if (hasMorphPosition && hasMorphNormal) break
  }

  if (!hasMorphPosition && !hasMorphNormal) return Promise.resolve(geometry)

  var pendingPositionAccessors = []
  var pendingNormalAccessors = []

  for (var i = 0, il = targets.length; i < il; i++) {
    var target = targets[i]

    if (hasMorphPosition) {
      var pendingAccessor =
        target.POSITION !== undefined ? parser.getDependency('accessor', target.POSITION) : geometry.attributes.position

      pendingPositionAccessors.push(pendingAccessor)
    }

    if (hasMorphNormal) {
      var pendingAccessor =
        target.NORMAL !== undefined ? parser.getDependency('accessor', target.NORMAL) : geometry.attributes.normal

      pendingNormalAccessors.push(pendingAccessor)
    }
  }

  return Promise.all([Promise.all(pendingPositionAccessors), Promise.all(pendingNormalAccessors)]).then(function (
    accessors
  ) {
    var morphPositions = accessors[0]
    var morphNormals = accessors[1]

    if (hasMorphPosition) geometry.morphAttributes.position = morphPositions
    if (hasMorphNormal) geometry.morphAttributes.normal = morphNormals
    geometry.morphTargetsRelative = true

    return geometry
  })
}

/**
 * @param {THREE.Mesh} mesh
 * @param {GLTF.Mesh} meshDef
 */
function updateMorphTargets(mesh, meshDef) {
  mesh.updateMorphTargets()

  if (meshDef.weights !== undefined) {
    for (var i = 0, il = meshDef.weights.length; i < il; i++) {
      mesh.morphTargetInfluences[i] = meshDef.weights[i]
    }
  }

  // .extras has user-defined data, so check that .extras.targetNames is an array.
  if (meshDef.extras && Array.isArray(meshDef.extras.targetNames)) {
    var targetNames = meshDef.extras.targetNames

    if (mesh.morphTargetInfluences.length === targetNames.length) {
      mesh.morphTargetDictionary = {}

      for (var i = 0, il = targetNames.length; i < il; i++) {
        mesh.morphTargetDictionary[targetNames[i]] = i
      }
    } else {
      console.warn('THREE.GLTFLoader: Invalid extras.targetNames length. Ignoring names.')
    }
  }
}

function createPrimitiveKey(primitiveDef) {
  var dracoExtension = primitiveDef.extensions && primitiveDef.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]
  var geometryKey

  if (dracoExtension) {
    geometryKey =
      'draco:' +
      dracoExtension.bufferView +
      ':' +
      dracoExtension.indices +
      ':' +
      createAttributesKey(dracoExtension.attributes)
  } else {
    geometryKey = primitiveDef.indices + ':' + createAttributesKey(primitiveDef.attributes) + ':' + primitiveDef.mode
  }

  return geometryKey
}

function createAttributesKey(attributes) {
  var attributesKey = ''

  var keys = Object.keys(attributes).sort()

  for (var i = 0, il = keys.length; i < il; i++) {
    attributesKey += keys[i] + ':' + attributes[keys[i]] + ';'
  }

  return attributesKey
}

/* GLTF PARSER */

function GLTFParser(json, options) {
  this.json = json || {}
  this.extensions = {}
  this.plugins = {}
  this.options = options || {}

  // loader object cache
  this.cache = new GLTFRegistry()

  // associations between Three.js objects and glTF elements
  this.associations = new Map()

  // BufferGeometry caching
  this.primitiveCache = {}

  // Object3D instance caches
  this.meshCache = { refs: {}, uses: {} }
  this.cameraCache = { refs: {}, uses: {} }
  this.lightCache = { refs: {}, uses: {} }

  // Track node names, to ensure no duplicates
  this.nodeNamesUsed = {}

  // Use an ImageBitmapLoader if imageBitmaps are supported. Moves much of the
  // expensive work of uploading a texture to the GPU off the main thread.
  if (typeof createImageBitmap !== 'undefined' && /Firefox/.test(navigator.userAgent) === false) {
    this.textureLoader = new THREE.ImageBitmapLoader(this.options.manager)
  } else {
    this.textureLoader = new THREE.TextureLoader(this.options.manager)
  }

  this.textureLoader.setCrossOrigin(this.options.crossOrigin)

  this.fileLoader = new THREE.FileLoader(this.options.manager)
  this.fileLoader.setResponseType('arraybuffer')

  if (this.options.crossOrigin === 'use-credentials') {
    this.fileLoader.setWithCredentials(true)
  }
}

GLTFParser.prototype.setExtensions = function (extensions) {
  this.extensions = extensions
}

GLTFParser.prototype.setPlugins = function (plugins) {
  this.plugins = plugins
}

GLTFParser.prototype.parse = function (onLoad, onError) {
  var parser = this
  var json = this.json
  var extensions = this.extensions

  // Clear the loader cache
  this.cache.removeAll()

  // Mark the special nodes/meshes in json for efficient parse
  this._invokeAll(function (ext) {
    return ext._markDefs && ext._markDefs()
  })

  Promise.all([this.getDependencies('scene'), this.getDependencies('animation'), this.getDependencies('camera')])
    .then(function (dependencies) {
      var result = {
        scene: dependencies[0][json.scene || 0],
        scenes: dependencies[0],
        animations: dependencies[1],
        cameras: dependencies[2],
        asset: json.asset,
        parser: parser,
        userData: {},
      }

      addUnknownExtensionsToUserData(extensions, result, json)

      assignExtrasToUserData(result, json)

      onLoad(result)
    })
    .catch(onError)
}

/**
 * Marks the special nodes/meshes in json for efficient parse.
 */
GLTFParser.prototype._markDefs = function () {
  var nodeDefs = this.json.nodes || []
  var skinDefs = this.json.skins || []
  var meshDefs = this.json.meshes || []

  // Nothing in the node definition indicates whether it is a Bone or an
  // Object3D. Use the skins' joint references to mark bones.
  for (var skinIndex = 0, skinLength = skinDefs.length; skinIndex < skinLength; skinIndex++) {
    var joints = skinDefs[skinIndex].joints

    for (var i = 0, il = joints.length; i < il; i++) {
      nodeDefs[joints[i]].isBone = true
    }
  }

  // Iterate over all nodes, marking references to shared resources,
  // as well as skeleton joints.
  for (var nodeIndex = 0, nodeLength = nodeDefs.length; nodeIndex < nodeLength; nodeIndex++) {
    var nodeDef = nodeDefs[nodeIndex]

    if (nodeDef.mesh !== undefined) {
      this._addNodeRef(this.meshCache, nodeDef.mesh)

      // Nothing in the mesh definition indicates whether it is
      // a SkinnedMesh or Mesh. Use the node's mesh reference
      // to mark SkinnedMesh if node has skin.
      if (nodeDef.skin !== undefined) {
        meshDefs[nodeDef.mesh].isSkinnedMesh = true
      }
    }

    if (nodeDef.camera !== undefined) {
      this._addNodeRef(this.cameraCache, nodeDef.camera)
    }
  }
}

/**
 * Counts references to shared node / Object3D resources. These resources
 * can be reused, or "instantiated", at multiple nodes in the scene
 * hierarchy. Mesh, Camera, and Light instances are instantiated and must
 * be marked. Non-scenegraph resources (like Materials, Geometries, and
 * Textures) can be reused directly and are not marked here.
 *
 * Example: CesiumMilkTruck sample model reuses "Wheel" meshes.
 */
GLTFParser.prototype._addNodeRef = function (cache, index) {
  if (index === undefined) return

  if (cache.refs[index] === undefined) {
    cache.refs[index] = cache.uses[index] = 0
  }

  cache.refs[index]++
}

/** Returns a reference to a shared resource, cloning it if necessary. */
GLTFParser.prototype._getNodeRef = function (cache, index, object) {
  if (cache.refs[index] <= 1) return object

  var ref = object.clone()

  ref.name += '_instance_' + cache.uses[index]++

  return ref
}

GLTFParser.prototype._invokeOne = function (func) {
  var extensions = Object.values(this.plugins)
  extensions.push(this)

  for (var i = 0; i < extensions.length; i++) {
    var result = func(extensions[i])

    if (result) return result
  }
}

GLTFParser.prototype._invokeAll = function (func) {
  var extensions = Object.values(this.plugins)
  extensions.unshift(this)

  var pending = []

  for (var i = 0; i < extensions.length; i++) {
    var result = func(extensions[i])

    if (result) pending.push(result)
  }

  return pending
}

/**
 * Requests the specified dependency asynchronously, with caching.
 * @param {string} type
 * @param {number} index
 * @return {Promise<THREE.Object3D|THREE.Material|THREE.Texture|THREE.AnimationClip|ArrayBuffer|Object>}
 */
GLTFParser.prototype.getDependency = function (type, index) {
  var cacheKey = type + ':' + index
  var dependency = this.cache.get(cacheKey)

  if (!dependency) {
    switch (type) {
      case 'scene':
        dependency = this.loadScene(index)
        break

      case 'node':
        dependency = this.loadNode(index)
        break

      case 'mesh':
        dependency = this._invokeOne(function (ext) {
          return ext.loadMesh && ext.loadMesh(index)
        })
        break

      case 'accessor':
        dependency = this.loadAccessor(index)
        break

      case 'bufferView':
        dependency = Promise.resolve(new Float32Array(0))
        break

      case 'buffer':
        dependency = Promise.resolve(new Float32Array(0))
        break

      case 'material':
        dependency = this._invokeOne(function (ext) {
          return ext.loadMaterial && ext.loadMaterial(index)
        })
        break

      case 'skin':
        dependency = this.loadSkin(index)
        break

      case 'animation':
        dependency = this.loadAnimation(index)
        break

      case 'camera':
        dependency = this.loadCamera(index)
        break

      default:
        throw new Error('Unknown type: ' + type)
    }

    this.cache.add(cacheKey, dependency)
  }

  return dependency
}

/**
 * Requests all dependencies of the specified type asynchronously, with caching.
 * @param {string} type
 * @return {Promise<Array<Object>>}
 */
GLTFParser.prototype.getDependencies = function (type) {
  var dependencies = this.cache.get(type)

  if (!dependencies) {
    var parser = this
    var defs = this.json[type + (type === 'mesh' ? 'es' : 's')] || []

    dependencies = Promise.all(
      defs.map(function (def, index) {
        return parser.getDependency(type, index)
      })
    )

    this.cache.add(type, dependencies)
  }

  return dependencies
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
 * @param {number} bufferIndex
 * @return {Promise<ArrayBuffer>}
 */
GLTFParser.prototype.loadBuffer = function (bufferIndex) {
  var bufferDef = this.json.buffers[bufferIndex]
  var loader = this.fileLoader

  if (bufferDef.type && bufferDef.type !== 'arraybuffer') {
    throw new Error('THREE.GLTFLoader: ' + bufferDef.type + ' buffer type is not supported.')
  }

  // If present, GLB container is required to be the first buffer.
  if (bufferDef.uri === undefined && bufferIndex === 0) {
    return Promise.resolve(this.extensions[EXTENSIONS.KHR_BINARY_GLTF].body)
  }

  var options = this.options

  return new Promise(function (resolve, reject) {
    loader.load(resolveURL(bufferDef.uri, options.path), resolve, undefined, function () {
      reject(new Error('THREE.GLTFLoader: Failed to load buffer "' + bufferDef.uri + '".'))
    })
  })
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#buffers-and-buffer-views
 * @param {number} bufferViewIndex
 * @return {Promise<ArrayBuffer>}
 */
GLTFParser.prototype.loadBufferView = function (bufferViewIndex) {
  var bufferViewDef = this.json.bufferViews[bufferViewIndex]

  return this.getDependency('buffer', bufferViewDef.buffer).then(function (buffer) {
    var byteLength = bufferViewDef.byteLength || 0
    var byteOffset = bufferViewDef.byteOffset || 0
    return buffer.slice(byteOffset, byteOffset + byteLength)
  })
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#accessors
 * @param {number} accessorIndex
 * @return {Promise<THREE.BufferAttribute|THREE.InterleavedBufferAttribute>}
 */
GLTFParser.prototype.loadAccessor = function (accessorIndex) {
  var parser = this
  var json = this.json

  var accessorDef = this.json.accessors[accessorIndex]

  if (accessorDef.bufferView === undefined && accessorDef.sparse === undefined) {
    // Ignore empty accessors, which may be used to declare runtime
    // information about attributes coming from another source (e.g. Draco
    // compression extension).
    return Promise.resolve(null)
  }

  var pendingBufferViews = []

  if (accessorDef.bufferView !== undefined) {
    pendingBufferViews.push(this.getDependency('bufferView', accessorDef.bufferView))
  } else {
    pendingBufferViews.push(null)
  }

  if (accessorDef.sparse !== undefined) {
    pendingBufferViews.push(this.getDependency('bufferView', accessorDef.sparse.indices.bufferView))
    pendingBufferViews.push(this.getDependency('bufferView', accessorDef.sparse.values.bufferView))
  }

  return Promise.all(pendingBufferViews).then(function (bufferViews) {
    var bufferView = bufferViews[0]

    var itemSize = WEBGL_TYPE_SIZES[accessorDef.type]
    var TypedArray = WEBGL_COMPONENT_TYPES[accessorDef.componentType]

    // For VEC3: itemSize is 3, elementBytes is 4, itemBytes is 12.
    var elementBytes = TypedArray.BYTES_PER_ELEMENT
    var itemBytes = elementBytes * itemSize
    var byteOffset = accessorDef.byteOffset || 0
    var byteStride =
      accessorDef.bufferView !== undefined ? json.bufferViews[accessorDef.bufferView].byteStride : undefined
    var normalized = accessorDef.normalized === true
    var array, bufferAttribute

    // The buffer is not interleaved if the stride is the item size in bytes.
    if (byteStride && byteStride !== itemBytes) {
      // Each "slice" of the buffer, as defined by 'count' elements of 'byteStride' bytes, gets its own InterleavedBuffer
      // This makes sure that IBA.count reflects accessor.count properly
      var ibSlice = Math.floor(byteOffset / byteStride)
      var ibCacheKey =
        'InterleavedBuffer:' +
        accessorDef.bufferView +
        ':' +
        accessorDef.componentType +
        ':' +
        ibSlice +
        ':' +
        accessorDef.count
      var ib = parser.cache.get(ibCacheKey)

      if (!ib) {
        array = new TypedArray(bufferView, ibSlice * byteStride, (accessorDef.count * byteStride) / elementBytes)

        // Integer parameters to IB/IBA are in array elements, not bytes.
        ib = new THREE.InterleavedBuffer(array, byteStride / elementBytes)

        parser.cache.add(ibCacheKey, ib)
      }

      bufferAttribute = new THREE.InterleavedBufferAttribute(
        ib,
        itemSize,
        (byteOffset % byteStride) / elementBytes,
        normalized
      )
    } else {
      if (bufferView === null) {
        array = new TypedArray(accessorDef.count * itemSize)
      } else {
        array = new TypedArray(bufferView, byteOffset, accessorDef.count * itemSize)
      }
      bufferAttribute = new THREE.BufferAttribute(array, itemSize, normalized)
    }

    // https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#sparse-accessors
    if (accessorDef.sparse !== undefined) {
      var itemSizeIndices = WEBGL_TYPE_SIZES.SCALAR
      var TypedArrayIndices = WEBGL_COMPONENT_TYPES[accessorDef.sparse.indices.componentType]

      var byteOffsetIndices = accessorDef.sparse.indices.byteOffset || 0
      var byteOffsetValues = accessorDef.sparse.values.byteOffset || 0

      var sparseIndices = new TypedArrayIndices(
        bufferViews[1],
        byteOffsetIndices,
        accessorDef.sparse.count * itemSizeIndices
      )
      var sparseValues = new TypedArray(bufferViews[2], byteOffsetValues, accessorDef.sparse.count * itemSize)

      if (bufferView !== null) {
        // Avoid modifying the original ArrayBuffer, if the bufferView wasn't initialized with zeroes.
        bufferAttribute = new THREE.BufferAttribute(
          bufferAttribute.array.slice(),
          bufferAttribute.itemSize,
          bufferAttribute.normalized
        )
      }

      for (var i = 0, il = sparseIndices.length; i < il; i++) {
        var index = sparseIndices[i]

        bufferAttribute.setX(index, sparseValues[i * itemSize])
        if (itemSize >= 2) bufferAttribute.setY(index, sparseValues[i * itemSize + 1])
        if (itemSize >= 3) bufferAttribute.setZ(index, sparseValues[i * itemSize + 2])
        if (itemSize >= 4) bufferAttribute.setW(index, sparseValues[i * itemSize + 3])
        if (itemSize >= 5) throw new Error('THREE.GLTFLoader: Unsupported itemSize in sparse BufferAttribute.')
      }
    }

    if (bufferAttribute.isInterleavedBufferAttribute) {
      bufferAttribute.data.count = accessorDef.count
    } else {
      bufferAttribute.count = accessorDef.count
    }
    return bufferAttribute
  })
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#textures
 * @param {number} textureIndex
 * @return {Promise<THREE.Texture>}
 */
GLTFParser.prototype.loadTexture = function (textureIndex) {
  return Promise.resolve(new THREE.Texture())
}

/**
 * Assigns final material to a Mesh, Line, or Points instance. The instance
 * already has a material (generated from the glTF material options alone)
 * but reuse of the same glTF material may require multiple threejs materials
 * to accomodate different primitive types, defines, etc. New materials will
 * be created if necessary, and reused from a cache.
 * @param  {THREE.Object3D} mesh Mesh, Line, or Points instance.
 */
GLTFParser.prototype.assignFinalMaterial = function (mesh) {
  var geometry = mesh.geometry
  var material = mesh.material

  var useVertexTangents = geometry.attributes.tangent !== undefined
  var useVertexColors = geometry.attributes.color !== undefined
  var useFlatShading = geometry.attributes.normal === undefined
  var useSkinning = mesh.isSkinnedMesh === true
  var useMorphTargets = Object.keys(geometry.morphAttributes).length > 0
  var useMorphNormals = useMorphTargets && geometry.morphAttributes.normal !== undefined

  if (mesh.isPoints) {
    var cacheKey = 'PointsMaterial:' + material.uuid

    var pointsMaterial = this.cache.get(cacheKey)

    if (!pointsMaterial) {
      pointsMaterial = new THREE.PointsMaterial()
      THREE.Material.prototype.copy.call(pointsMaterial, material)
      pointsMaterial.color.copy(material.color)
      pointsMaterial.map = material.map
      pointsMaterial.sizeAttenuation = false // glTF spec says points should be 1px

      this.cache.add(cacheKey, pointsMaterial)
    }

    material = pointsMaterial
  } else if (mesh.isLine) {
    var cacheKey = 'LineBasicMaterial:' + material.uuid

    var lineMaterial = this.cache.get(cacheKey)

    if (!lineMaterial) {
      lineMaterial = new THREE.LineBasicMaterial()
      THREE.Material.prototype.copy.call(lineMaterial, material)
      lineMaterial.color.copy(material.color)

      this.cache.add(cacheKey, lineMaterial)
    }

    material = lineMaterial
  }

  // Clone the material if it will be modified
  if (useVertexTangents || useVertexColors || useFlatShading || useSkinning || useMorphTargets) {
    var cacheKey = 'ClonedMaterial:' + material.uuid + ':'

    if (material.isGLTFSpecularGlossinessMaterial) cacheKey += 'specular-glossiness:'
    if (useSkinning) cacheKey += 'skinning:'
    if (useVertexTangents) cacheKey += 'vertex-tangents:'
    if (useVertexColors) cacheKey += 'vertex-colors:'
    if (useFlatShading) cacheKey += 'flat-shading:'
    if (useMorphTargets) cacheKey += 'morph-targets:'
    if (useMorphNormals) cacheKey += 'morph-normals:'

    var cachedMaterial = this.cache.get(cacheKey)

    if (!cachedMaterial) {
      cachedMaterial = material.clone()

      if (useSkinning) cachedMaterial.skinning = true
      if (useVertexTangents) cachedMaterial.vertexTangents = true
      if (useVertexColors) cachedMaterial.vertexColors = true
      if (useFlatShading) cachedMaterial.flatShading = true
      if (useMorphTargets) cachedMaterial.morphTargets = true
      if (useMorphNormals) cachedMaterial.morphNormals = true

      this.cache.add(cacheKey, cachedMaterial)

      this.associations.set(cachedMaterial, this.associations.get(material))
    }

    material = cachedMaterial
  }

  // workarounds for mesh and geometry

  if (material.aoMap && geometry.attributes.uv2 === undefined && geometry.attributes.uv !== undefined) {
    geometry.setAttribute('uv2', geometry.attributes.uv)
  }

  // https://github.com/mrdoob/three.js/issues/11438#issuecomment-507003995
  if (material.normalScale && !useVertexTangents) {
    material.normalScale.y = -material.normalScale.y
  }

  if (material.clearcoatNormalScale && !useVertexTangents) {
    material.clearcoatNormalScale.y = -material.clearcoatNormalScale.y
  }

  mesh.material = material
}

GLTFParser.prototype.getMaterialType = function (/* materialIndex */) {
  return THREE.MeshStandardMaterial
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#materials
 * @param {number} materialIndex
 * @return {Promise<THREE.Material>}
 */
GLTFParser.prototype.loadMaterial = function (materialIndex) {
  var parser = this
  var json = this.json
  var extensions = this.extensions
  var materialDef = json.materials[materialIndex]

  var materialType
  var materialParams = {}
  var materialExtensions = materialDef.extensions || {}

  var pending = []

  if (materialExtensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS]) {
    var sgExtension = extensions[EXTENSIONS.KHR_MATERIALS_PBR_SPECULAR_GLOSSINESS]
    materialType = sgExtension.getMaterialType()
    pending.push(sgExtension.extendParams(materialParams, materialDef, parser))
  } else if (materialExtensions[EXTENSIONS.KHR_MATERIALS_UNLIT]) {
    var kmuExtension = extensions[EXTENSIONS.KHR_MATERIALS_UNLIT]
    materialType = kmuExtension.getMaterialType()
    pending.push(kmuExtension.extendParams(materialParams, materialDef, parser))
  } else {
    // Specification:
    // https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#metallic-roughness-material

    var metallicRoughness = materialDef.pbrMetallicRoughness || {}

    materialParams.color = new THREE.Color(1.0, 1.0, 1.0)
    materialParams.opacity = 1.0

    if (Array.isArray(metallicRoughness.baseColorFactor)) {
      var array = metallicRoughness.baseColorFactor

      materialParams.color.fromArray(array)
      materialParams.opacity = array[3]
    }

    materialParams.metalness = metallicRoughness.metallicFactor !== undefined ? metallicRoughness.metallicFactor : 1.0
    materialParams.roughness = metallicRoughness.roughnessFactor !== undefined ? metallicRoughness.roughnessFactor : 1.0

    materialType = this._invokeOne(function (ext) {
      return ext.getMaterialType && ext.getMaterialType(materialIndex)
    })

    pending.push(
      Promise.all(
        this._invokeAll(function (ext) {
          return ext.extendMaterialParams && ext.extendMaterialParams(materialIndex, materialParams)
        })
      )
    )
  }

  if (materialDef.doubleSided === true) {
    materialParams.side = THREE.DoubleSide
  }

  var alphaMode = materialDef.alphaMode || ALPHA_MODES.OPAQUE

  if (alphaMode === ALPHA_MODES.BLEND) {
    materialParams.transparent = true

    // See: https://github.com/mrdoob/three.js/issues/17706
    materialParams.depthWrite = false
  } else {
    materialParams.transparent = false

    if (alphaMode === ALPHA_MODES.MASK) {
      materialParams.alphaTest = materialDef.alphaCutoff !== undefined ? materialDef.alphaCutoff : 0.5
    }
  }

  if (materialDef.normalTexture !== undefined && materialType !== THREE.MeshBasicMaterial) {
    materialParams.normalScale = new THREE.Vector2(1, 1)

    if (materialDef.normalTexture.scale !== undefined) {
      materialParams.normalScale.set(materialDef.normalTexture.scale, materialDef.normalTexture.scale)
    }
  }

  if (materialDef.occlusionTexture !== undefined && materialType !== THREE.MeshBasicMaterial) {
    if (materialDef.occlusionTexture.strength !== undefined) {
      materialParams.aoMapIntensity = materialDef.occlusionTexture.strength
    }
  }

  if (materialDef.emissiveFactor !== undefined && materialType !== THREE.MeshBasicMaterial) {
    materialParams.emissive = new THREE.Color().fromArray(materialDef.emissiveFactor)
  }

  return Promise.all(pending).then(function () {
    var material

    material = new materialType(materialParams)

    if (materialDef.name) material.name = materialDef.name

    // baseColorTexture, emissiveTexture, and specularGlossinessTexture use sRGB encoding.
    if (material.map) material.map.encoding = THREE.sRGBEncoding
    if (material.emissiveMap) material.emissiveMap.encoding = THREE.sRGBEncoding

    assignExtrasToUserData(material, materialDef)

    parser.associations.set(material, { type: 'materials', index: materialIndex })

    if (materialDef.extensions) addUnknownExtensionsToUserData(extensions, material, materialDef)

    return material
  })
}

/** When Object3D instances are targeted by animation, they need unique names. */
GLTFParser.prototype.createUniqueName = function (originalName) {
  var sanitizedName = THREE.PropertyBinding.sanitizeNodeName(originalName || '')

  var name = sanitizedName

  for (var i = 1; this.nodeNamesUsed[name]; ++i) {
    name = sanitizedName + '_' + i
  }

  this.nodeNamesUsed[name] = true

  return name
}

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 */
function computeBounds(geometry, primitiveDef, parser) {
  var attributes = primitiveDef.attributes

  var box = new THREE.Box3()

  if (attributes.POSITION !== undefined) {
    var accessor = parser.json.accessors[attributes.POSITION]

    var min = accessor.min
    var max = accessor.max

    // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

    if (min !== undefined && max !== undefined) {
      box.set(new THREE.Vector3(min[0], min[1], min[2]), new THREE.Vector3(max[0], max[1], max[2]))
    } else {
      console.warn('THREE.GLTFLoader: Missing min/max properties for accessor POSITION.')

      return
    }
  } else {
    return
  }

  var targets = primitiveDef.targets

  if (targets !== undefined) {
    var maxDisplacement = new THREE.Vector3()
    var vector = new THREE.Vector3()

    for (var i = 0, il = targets.length; i < il; i++) {
      var target = targets[i]

      if (target.POSITION !== undefined) {
        var accessor = parser.json.accessors[target.POSITION]
        var min = accessor.min
        var max = accessor.max

        // glTF requires 'min' and 'max', but VRM (which extends glTF) currently ignores that requirement.

        if (min !== undefined && max !== undefined) {
          // we need to get max of absolute components because target weight is [-1,1]
          vector.setX(Math.max(Math.abs(min[0]), Math.abs(max[0])))
          vector.setY(Math.max(Math.abs(min[1]), Math.abs(max[1])))
          vector.setZ(Math.max(Math.abs(min[2]), Math.abs(max[2])))

          // Note: this assumes that the sum of all weights is at most 1. This isn't quite correct - it's more conservative
          // to assume that each target can have a max weight of 1. However, for some use cases - notably, when morph targets
          // are used to implement key-frame animations and as such only two are active at a time - this results in very large
          // boxes. So for now we make a box that's sometimes a touch too small but is hopefully mostly of reasonable size.
          maxDisplacement.max(vector)
        } else {
          console.warn('THREE.GLTFLoader: Missing min/max properties for accessor POSITION.')
        }
      }
    }

    // As per comment above this box isn't conservative, but has a reasonable size for a very large number of morph targets.
    box.expandByVector(maxDisplacement)
  }

  geometry.boundingBox = box

  var sphere = new THREE.Sphere()

  box.getCenter(sphere.center)
  sphere.radius = box.min.distanceTo(box.max) / 2

  geometry.boundingSphere = sphere
}

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {GLTF.Primitive} primitiveDef
 * @param {GLTFParser} parser
 * @return {Promise<THREE.BufferGeometry>}
 */
function addPrimitiveAttributes(geometry, primitiveDef, parser) {
  var attributes = primitiveDef.attributes

  var pending = []

  function assignAttributeAccessor(accessorIndex, attributeName) {
    return parser.getDependency('accessor', accessorIndex).then(function (accessor) {
      geometry.setAttribute(attributeName, accessor)
    })
  }

  for (var gltfAttributeName in attributes) {
    var threeAttributeName = ATTRIBUTES[gltfAttributeName] || gltfAttributeName.toLowerCase()

    // Skip attributes already provided by e.g. Draco extension.
    if (threeAttributeName in geometry.attributes) continue

    pending.push(assignAttributeAccessor(attributes[gltfAttributeName], threeAttributeName))
  }

  if (primitiveDef.indices !== undefined && !geometry.index) {
    var accessor = parser.getDependency('accessor', primitiveDef.indices).then(function (accessor) {
      geometry.setIndex(accessor)
    })

    pending.push(accessor)
  }

  assignExtrasToUserData(geometry, primitiveDef)

  computeBounds(geometry, primitiveDef, parser)

  return Promise.all(pending).then(function () {
    return primitiveDef.targets !== undefined ? addMorphTargets(geometry, primitiveDef.targets, parser) : geometry
  })
}

/**
 * @param {THREE.BufferGeometry} geometry
 * @param {Number} drawMode
 * @return {THREE.BufferGeometry}
 */
function toTrianglesDrawMode(geometry, drawMode) {
  var index = geometry.getIndex()

  // generate index if not present

  if (index === null) {
    var indices = []

    var position = geometry.getAttribute('position')

    if (position !== undefined) {
      for (var i = 0; i < position.count; i++) {
        indices.push(i)
      }

      geometry.setIndex(indices)
      index = geometry.getIndex()
    } else {
      console.error('THREE.GLTFLoader.toTrianglesDrawMode(): Undefined position attribute. Processing not possible.')
      return geometry
    }
  }

  //

  var numberOfTriangles = index.count - 2
  var newIndices = []

  if (drawMode === THREE.TriangleFanDrawMode) {
    // gl.TRIANGLE_FAN

    for (var i = 1; i <= numberOfTriangles; i++) {
      newIndices.push(index.getX(0))
      newIndices.push(index.getX(i))
      newIndices.push(index.getX(i + 1))
    }
  } else {
    // gl.TRIANGLE_STRIP

    for (var i = 0; i < numberOfTriangles; i++) {
      if (i % 2 === 0) {
        newIndices.push(index.getX(i))
        newIndices.push(index.getX(i + 1))
        newIndices.push(index.getX(i + 2))
      } else {
        newIndices.push(index.getX(i + 2))
        newIndices.push(index.getX(i + 1))
        newIndices.push(index.getX(i))
      }
    }
  }

  if (newIndices.length / 3 !== numberOfTriangles) {
    console.error('THREE.GLTFLoader.toTrianglesDrawMode(): Unable to generate correct amount of triangles.')
  }

  // build final geometry

  var newGeometry = geometry.clone()
  newGeometry.setIndex(newIndices)

  return newGeometry
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#geometry
 *
 * Creates BufferGeometries from primitives.
 *
 * @param {Array<GLTF.Primitive>} primitives
 * @return {Promise<Array<THREE.BufferGeometry>>}
 */
GLTFParser.prototype.loadGeometries = function (primitives) {
  var parser = this
  var extensions = this.extensions
  var cache = this.primitiveCache

  function createDracoPrimitive(primitive) {
    return extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]
      .decodePrimitive(primitive, parser)
      .then(function (geometry) {
        return addPrimitiveAttributes(geometry, primitive, parser)
      })
  }

  var pending = []

  for (var i = 0, il = primitives.length; i < il; i++) {
    var primitive = primitives[i]
    var cacheKey = createPrimitiveKey(primitive)

    // See if we've already created this geometry
    var cached = cache[cacheKey]

    if (cached) {
      // Use the cached geometry if it exists
      pending.push(cached.promise)
    } else {
      var geometryPromise

      if (primitive.extensions && primitive.extensions[EXTENSIONS.KHR_DRACO_MESH_COMPRESSION]) {
        // Use DRACO geometry if available
        geometryPromise = createDracoPrimitive(primitive)
      } else {
        // Otherwise create a new geometry
        geometryPromise = addPrimitiveAttributes(new THREE.BufferGeometry(), primitive, parser)
      }

      // Cache this geometry
      cache[cacheKey] = { primitive: primitive, promise: geometryPromise }

      pending.push(geometryPromise)
    }
  }

  return Promise.all(pending)
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/blob/master/specification/2.0/README.md#meshes
 * @param {number} meshIndex
 * @return {Promise<THREE.Group|THREE.Mesh|THREE.SkinnedMesh>}
 */
GLTFParser.prototype.loadMesh = function (meshIndex) {
  var parser = this
  var json = this.json
  var extensions = this.extensions

  var meshDef = json.meshes[meshIndex]
  var primitives = meshDef.primitives

  var pending = []

  for (var i = 0, il = primitives.length; i < il; i++) {
    var material =
      primitives[i].material === undefined
        ? createDefaultMaterial(this.cache)
        : this.getDependency('material', primitives[i].material)

    pending.push(material)
  }

  pending.push(parser.loadGeometries(primitives))

  return Promise.all(pending).then(function (results) {
    var materials = results.slice(0, results.length - 1)
    var geometries = results[results.length - 1]

    var meshes = []

    for (var i = 0, il = geometries.length; i < il; i++) {
      var geometry = geometries[i]
      var primitive = primitives[i]

      // 1. create Mesh

      var mesh

      var material = materials[i]

      if (
        primitive.mode === WEBGL_CONSTANTS.TRIANGLES ||
        primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP ||
        primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN ||
        primitive.mode === undefined
      ) {
        // .isSkinnedMesh isn't in glTF spec. See ._markDefs()
        geometry.morphAttributes = {}
        mesh =
          meshDef.isSkinnedMesh === true
            ? new THREE.SkinnedMesh(geometry, material)
            : new THREE.Mesh(geometry, material)

        if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_STRIP) {
          mesh.geometry = toTrianglesDrawMode(mesh.geometry, THREE.TriangleStripDrawMode)
        } else if (primitive.mode === WEBGL_CONSTANTS.TRIANGLE_FAN) {
          mesh.geometry = toTrianglesDrawMode(mesh.geometry, THREE.TriangleFanDrawMode)
        }
      } else if (primitive.mode === WEBGL_CONSTANTS.LINES) {
        mesh = new THREE.LineSegments(geometry, material)
      } else if (primitive.mode === WEBGL_CONSTANTS.LINE_STRIP) {
        mesh = new THREE.Line(geometry, material)
      } else if (primitive.mode === WEBGL_CONSTANTS.LINE_LOOP) {
        mesh = new THREE.LineLoop(geometry, material)
      } else if (primitive.mode === WEBGL_CONSTANTS.POINTS) {
        mesh = new THREE.Points(geometry, material)
      } else {
        throw new Error('THREE.GLTFLoader: Primitive mode unsupported: ' + primitive.mode)
      }

      if (Object.keys(mesh.geometry.morphAttributes).length > 0) {
        updateMorphTargets(mesh, meshDef)
      }

      mesh.name = parser.createUniqueName(meshDef.name || 'mesh_' + meshIndex)

      assignExtrasToUserData(mesh, meshDef)
      if (primitive.extensions) addUnknownExtensionsToUserData(extensions, mesh, primitive)

      parser.assignFinalMaterial(mesh)

      meshes.push(mesh)
    }

    if (meshes.length === 1) {
      return meshes[0]
    }

    var group = new THREE.Group()

    for (var i = 0, il = meshes.length; i < il; i++) {
      group.add(meshes[i])
    }

    return group
  })
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#cameras
 * @param {number} cameraIndex
 * @return {Promise<THREE.Camera>}
 */
GLTFParser.prototype.loadCamera = function (cameraIndex) {
  var camera
  var cameraDef = this.json.cameras[cameraIndex]
  var params = cameraDef[cameraDef.type]

  if (!params) {
    console.warn('THREE.GLTFLoader: Missing camera parameters.')
    return
  }

  if (cameraDef.type === 'perspective') {
    camera = new THREE.PerspectiveCamera(
      THREE.MathUtils.radToDeg(params.yfov),
      params.aspectRatio || 1,
      params.znear || 1,
      params.zfar || 2e6
    )
  } else if (cameraDef.type === 'orthographic') {
    camera = new THREE.OrthographicCamera(
      -params.xmag,
      params.xmag,
      params.ymag,
      -params.ymag,
      params.znear,
      params.zfar
    )
  }

  if (cameraDef.name) camera.name = this.createUniqueName(cameraDef.name)

  assignExtrasToUserData(camera, cameraDef)

  return Promise.resolve(camera)
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#skins
 * @param {number} skinIndex
 * @return {Promise<Object>}
 */
GLTFParser.prototype.loadSkin = function (skinIndex) {
  var skinDef = this.json.skins[skinIndex]

  var skinEntry = { joints: skinDef.joints }

  if (skinDef.inverseBindMatrices === undefined) {
    return Promise.resolve(skinEntry)
  }

  return this.getDependency('accessor', skinDef.inverseBindMatrices).then(function (accessor) {
    skinEntry.inverseBindMatrices = accessor

    return skinEntry
  })
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#animations
 * @param {number} animationIndex
 * @return {Promise<THREE.AnimationClip>}
 */
GLTFParser.prototype.loadAnimation = function (animationIndex) {
  var json = this.json

  var animationDef = json.animations[animationIndex]

  var pendingNodes = []
  var pendingInputAccessors = []
  var pendingOutputAccessors = []
  var pendingSamplers = []
  var pendingTargets = []

  for (var i = 0, il = animationDef.channels.length; i < il; i++) {
    var channel = animationDef.channels[i]
    var sampler = animationDef.samplers[channel.sampler]
    var target = channel.target
    var name = target.node !== undefined ? target.node : target.id // NOTE: target.id is deprecated.
    var input = animationDef.parameters !== undefined ? animationDef.parameters[sampler.input] : sampler.input
    var output = animationDef.parameters !== undefined ? animationDef.parameters[sampler.output] : sampler.output

    pendingNodes.push(this.getDependency('node', name))
    pendingInputAccessors.push(this.getDependency('accessor', input))
    pendingOutputAccessors.push(this.getDependency('accessor', output))
    pendingSamplers.push(sampler)
    pendingTargets.push(target)
  }

  return Promise.all([
    Promise.all(pendingNodes),
    Promise.all(pendingInputAccessors),
    Promise.all(pendingOutputAccessors),
    Promise.all(pendingSamplers),
    Promise.all(pendingTargets),
  ]).then(function (dependencies) {
    var nodes = dependencies[0]
    var inputAccessors = dependencies[1]
    var outputAccessors = dependencies[2]
    var samplers = dependencies[3]
    var targets = dependencies[4]

    var tracks = []

    for (var i = 0, il = nodes.length; i < il; i++) {
      var node = nodes[i]
      var inputAccessor = inputAccessors[i]
      var outputAccessor = outputAccessors[i]
      var sampler = samplers[i]
      var target = targets[i]

      if (node === undefined) continue

      node.updateMatrix()
      node.matrixAutoUpdate = true

      var TypedKeyframeTrack

      switch (PATH_PROPERTIES[target.path]) {
        case PATH_PROPERTIES.weights:
          TypedKeyframeTrack = THREE.NumberKeyframeTrack
          break

        case PATH_PROPERTIES.rotation:
          TypedKeyframeTrack = THREE.QuaternionKeyframeTrack
          break

        case PATH_PROPERTIES.position:
        case PATH_PROPERTIES.scale:
        default:
          TypedKeyframeTrack = THREE.VectorKeyframeTrack
          break
      }

      var targetName = node.name ? node.name : node.uuid

      var interpolation =
        sampler.interpolation !== undefined ? INTERPOLATION[sampler.interpolation] : THREE.InterpolateLinear

      var targetNames = []

      if (PATH_PROPERTIES[target.path] === PATH_PROPERTIES.weights) {
        // Node may be a THREE.Group (glTF mesh with several primitives) or a THREE.Mesh.
        node.traverse(function (object) {
          if (object.isMesh === true && object.morphTargetInfluences) {
            targetNames.push(object.name ? object.name : object.uuid)
          }
        })
      } else {
        targetNames.push(targetName)
      }

      var outputArray = outputAccessor.array

      if (outputAccessor.normalized) {
        var scale

        if (outputArray.constructor === Int8Array) {
          scale = 1 / 127
        } else if (outputArray.constructor === Uint8Array) {
          scale = 1 / 255
        } else if (outputArray.constructor == Int16Array) {
          scale = 1 / 32767
        } else if (outputArray.constructor === Uint16Array) {
          scale = 1 / 65535
        } else {
          throw new Error('THREE.GLTFLoader: Unsupported output accessor component type.')
        }

        var scaled = new Float32Array(outputArray.length)

        for (var j = 0, jl = outputArray.length; j < jl; j++) {
          scaled[j] = outputArray[j] * scale
        }

        outputArray = scaled
      }
    }

    var name = animationDef.name ? animationDef.name : 'animation_' + animationIndex
    var clip = new THREE.AnimationClip(name, undefined, tracks)
    clip.targetNames = targetNames
    return clip
  })
}

GLTFParser.prototype.createNodeMesh = function (nodeIndex) {
  const json = this.json
  const parser = this
  const nodeDef = json.nodes[nodeIndex]

  if (nodeDef.mesh === undefined) return null

  return parser.getDependency('mesh', nodeDef.mesh).then(function (mesh) {
    const node = parser._getNodeRef(parser.meshCache, nodeDef.mesh, mesh)

    // if weights are provided on the node, override weights on the mesh.
    if (nodeDef.weights !== undefined) {
      node.traverse(function (o) {
        if (!o.isMesh) return

        for (let i = 0, il = nodeDef.weights.length; i < il; i++) {
          o.morphTargetInfluences[i] = nodeDef.weights[i]
        }
      })
    }

    return node
  })
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#nodes-and-hierarchy
 * @param {number} nodeIndex
 * @return {Promise<THREE.Object3D>}
 */
GLTFParser.prototype.loadNode = function (nodeIndex) {
  var json = this.json
  var extensions = this.extensions
  var parser = this

  var nodeDef = json.nodes[nodeIndex]

  // reserve node's name before its dependencies, so the root has the intended name.
  var nodeName = nodeDef.name ? parser.createUniqueName(nodeDef.name) : ''

  return (function () {
    var pending = []

    const meshPromise = parser._invokeOne(function (ext) {
      return ext.createNodeMesh && ext.createNodeMesh(nodeIndex)
    })

    if (meshPromise) {
      pending.push(meshPromise)
    }

    if (nodeDef.camera !== undefined) {
      pending.push(
        parser.getDependency('camera', nodeDef.camera).then(function (camera) {
          return parser._getNodeRef(parser.cameraCache, nodeDef.camera, camera)
        })
      )
    }

    parser
      ._invokeAll(function (ext) {
        return ext.createNodeAttachment && ext.createNodeAttachment(nodeIndex)
      })
      .forEach(function (promise) {
        pending.push(promise)
      })

    return Promise.all(pending)
  })().then(function (objects) {
    var node

    // .isBone isn't in glTF spec. See ._markDefs
    if (nodeDef.isBone === true) {
      node = new THREE.Bone()
    } else if (objects.length > 1) {
      node = new THREE.Group()
    } else if (objects.length === 1) {
      node = objects[0]
    } else {
      node = new THREE.Object3D()
    }

    if (node !== objects[0]) {
      for (var i = 0, il = objects.length; i < il; i++) {
        node.add(objects[i])
      }
    }

    if (nodeDef.name) {
      node.userData.name = nodeDef.name
      node.name = nodeName
    }

    assignExtrasToUserData(node, nodeDef)

    if (nodeDef.extensions) addUnknownExtensionsToUserData(extensions, node, nodeDef)

    if (nodeDef.matrix !== undefined) {
      var matrix = new THREE.Matrix4()
      matrix.fromArray(nodeDef.matrix)
      node.applyMatrix4(matrix)
    } else {
      if (nodeDef.translation !== undefined) {
        node.position.fromArray(nodeDef.translation)
      }

      if (nodeDef.rotation !== undefined) {
        node.quaternion.fromArray(nodeDef.rotation)
      }

      if (nodeDef.scale !== undefined) {
        node.scale.fromArray(nodeDef.scale)
      }
    }

    parser.associations.set(node, { type: 'nodes', index: nodeIndex })

    return node
  })
}

/**
 * Specification: https://github.com/KhronosGroup/glTF/tree/master/specification/2.0#scenes
 * @param {number} sceneIndex
 * @return {Promise<THREE.Group>}
 */
GLTFParser.prototype.loadScene = (function () {
  // scene node hierachy builder

  function buildNodeHierachy(nodeId, parentObject, json, parser) {
    var nodeDef = json.nodes[nodeId]

    return parser
      .getDependency('node', nodeId)
      .then(function (node) {
        if (nodeDef.skin === undefined) return node

        // build skeleton here as well

        var skinEntry

        return parser
          .getDependency('skin', nodeDef.skin)
          .then(function (skin) {
            skinEntry = skin

            var pendingJoints = []

            for (var i = 0, il = skinEntry.joints.length; i < il; i++) {
              pendingJoints.push(parser.getDependency('node', skinEntry.joints[i]))
            }

            return Promise.all(pendingJoints)
          })
          .then(function (jointNodes) {
            node.traverse(function (mesh) {
              if (!mesh.isMesh) return

              var bones = []
              var boneInverses = []

              for (var j = 0, jl = jointNodes.length; j < jl; j++) {
                var jointNode = jointNodes[j]

                if (jointNode) {
                  bones.push(jointNode)

                  var mat = new THREE.Matrix4()

                  if (skinEntry.inverseBindMatrices !== undefined) {
                    mat.fromArray(skinEntry.inverseBindMatrices.array, j * 16)
                  }

                  boneInverses.push(mat)
                } else {
                  console.warn('THREE.GLTFLoader: Joint "%s" could not be found.', skinEntry.joints[j])
                }
              }

              mesh.bind(new THREE.Skeleton(bones, boneInverses), mesh.matrixWorld)
            })

            return node
          })
      })
      .then(function (node) {
        // build node hierachy

        parentObject.add(node)

        var pending = []

        if (nodeDef.children) {
          var children = nodeDef.children

          for (var i = 0, il = children.length; i < il; i++) {
            var child = children[i]
            pending.push(buildNodeHierachy(child, node, json, parser))
          }
        }

        return Promise.all(pending)
      })
  }

  return function loadScene(sceneIndex) {
    var json = this.json
    var extensions = this.extensions
    var sceneDef = this.json.scenes[sceneIndex]
    var parser = this

    // Loader returns Group, not Scene.
    // See: https://github.com/mrdoob/three.js/issues/18342#issuecomment-578981172
    var scene = new THREE.Group()
    if (sceneDef.name) scene.name = parser.createUniqueName(sceneDef.name)

    assignExtrasToUserData(scene, sceneDef)

    if (sceneDef.extensions) addUnknownExtensionsToUserData(extensions, scene, sceneDef)

    var nodeIds = sceneDef.nodes || []

    var pending = []

    for (var i = 0, il = nodeIds.length; i < il; i++) {
      pending.push(buildNodeHierachy(nodeIds[i], scene, json, parser))
    }

    return Promise.all(pending).then(function () {
      return scene
    })
  }
})()
