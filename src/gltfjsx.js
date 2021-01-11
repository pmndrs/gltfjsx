const fs = require('fs')
require('jsdom-global')()
const THREE = (global.THREE = require('three'))
require('./bin/GLTFLoader')
const DracoLoader = require('./bin/DRACOLoader')
THREE.DRACOLoader.getDecoderModule = () => {}
const prettier = require('prettier')
const isVarName = require('is-var-name')
const path = require('path')

let options = {}

function toArrayBuffer(buf) {
  var ab = new ArrayBuffer(buf.length)
  var view = new Uint8Array(ab)
  for (var i = 0; i < buf.length; ++i) view[i] = buf[i]
  return ab
}

const gltfLoader = new THREE.GLTFLoader()
gltfLoader.setDRACOLoader(new DracoLoader())

function rNbr(number) {
  return parseFloat(number.toFixed(options.precision))
}

function rDeg(number) {
  const abs = Math.abs(Math.round(parseFloat(number) * 100000))
  for (let i = 1; i <= 10; i++) {
    if (abs === Math.round(parseFloat(Math.PI / i) * 100000))
      return `${number < 0 ? '-' : ''}Math.PI${i > 1 ? ' / ' + i : ''}`
  }
  for (let i = 1; i <= 10; i++) {
    if (abs === Math.round(parseFloat(Math.PI * i) * 100000))
      return `${number < 0 ? '-' : ''}Math.PI${i > 1 ? ' * ' + i : ''}`
  }
  return rNbr(number)
}

function sanitizeName(name) {
  return isVarName(name) ? `.${name}` : `['${name}']`
}

function printTypes(objects, animations) {
  let meshes = objects.filter((o) => o.isMesh && o.__removed === undefined)
  let bones = objects.filter((o) => o.isBone && !(o.parent && o.parent.isBone) && o.__removed === undefined)
  let materials = [...new Set(objects.filter((o) => o.material && o.material.name).map((o) => o.material))]

  let animationTypes = ''
  if (animations.length) {
    animationTypes = `\n
type ActionName = ${animations.map((clip, i) => `"${clip.name}"`).join(' | ')};
type GLTFActions = Record<ActionName, THREE.AnimationAction>;\n`
  }

  return `\ntype GLTFResult = GLTF & {
  nodes: {
    ${meshes.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
    ${bones.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
  }
  materials: {
    ${materials.map(({ name, type }) => (isVarName(name) ? name : `['${name}']`) + ': THREE.' + type).join(',')}
  }
}\n${animationTypes}`
}

function print(objects, gltf, obj, parent) {
  let result = ''
  let children = ''
  let type = obj.type.charAt(0).toLowerCase() + obj.type.slice(1)
  let node = 'nodes' + sanitizeName(obj.name)
  let hasAnimations = gltf.animations && gltf.animations.length > 0

  if (options.setLog)
    setTimeout(
      () => options.setLog((state) => [...state, obj.name]),
      (options.timeout = options.timeout + options.delay)
    )

  // Turn object3d's into groups, it should be faster according to the threejs docs
  if (type === 'object3D') type = 'group'
  if (obj instanceof THREE.PerspectiveCamera) type = 'PerspectiveCamera'
  if (obj instanceof THREE.OrthographicCamera) type = 'OrthographicCamera'

  // Bail out on lights and bones
  if (obj instanceof THREE.Bone) {
    return `<primitive object={${node}} />${!parent ? '' : '\n'}`
  }

  // Collect children
  if (obj.children) obj.children.forEach((child) => (children += print(objects, gltf, child, obj)))

  // Form the object in JSX syntax
  result = `<${type} `

  const oldResult = result

  // Include names when output is uncompressed or morphTargetDictionaries are present
  if (
    obj.name.length &&
    (options.verbose ||
      obj.morphTargetDictionary ||
      (hasAnimations && gltf.animations.find((clip) => clip.targetNames.includes(obj.name))))
  )
    result += `name="${obj.name}" `

  // Handle cameras
  if (obj instanceof THREE.Camera) {
    result += `makeDefault={false} `
    if (obj.zoom !== 1) result += `zoom={${rNbr(obj.zoom)}} `
    if (obj.far !== 2000) result += `far={${rNbr(obj.far)}} `
    if (obj.near !== 0.1) result += `near={${rNbr(obj.near)}} `
  }
  if (obj instanceof THREE.PerspectiveCamera) {
    if (obj.fov !== 50) result += `fov={${rNbr(obj.fov)}} `
  }

  // Write out geometry first
  if (obj.geometry) result += `geometry={${node}.geometry} `

  // Write out materials
  if (obj.material) {
    if (obj.material.name) result += `material={materials${sanitizeName(obj.material.name)}} `
    else result += `material={${node}.material} `
  }

  if (obj.skeleton) result += `skeleton={${node}.skeleton} `
  if (obj.visible === false) result += `visible={false} `
  if (obj.castShadow === true) result += `castShadow `
  if (obj.receiveShadow === true) result += `receiveShadow `
  if (obj.morphTargetDictionary) result += `morphTargetDictionary={${node}.morphTargetDictionary} `
  if (obj.morphTargetInfluences) result += `morphTargetInfluences={${node}.morphTargetInfluences} `
  if (obj.intensity) result += `intensity={${rNbr(obj.intensity)}} `
  //if (obj.power && obj.power !== 4 * Math.PI) result += `power={${rNbr(obj.power)}} `
  if (obj.angle && obj.angle !== Math.PI / 3) result += `angle={${rDeg(obj.angle)}} `
  if (obj.penumbra && obj.penumbra !== 0) result += `penumbra={${rNbr(obj.penumbra)}} `
  if (obj.decay && obj.decay !== 1) result += `decay={${rNbr(obj.decay)}} `
  if (obj.distance && obj.distance !== 0) result += `distance={${rNbr(obj.distance)}} `
  if (obj.color && obj.color.getHexString() !== 'ffffff') result += `color="#${obj.color.getHexString()}" `
  if (obj.up instanceof THREE.Vector3 && !obj.up.equals(new THREE.Vector3(0, 1, 0)))
    result += `up={[${rNbr(obj.up.x)}, ${rNbr(obj.up.y)}, ${rNbr(obj.up.z)},]} `
  if (obj.position instanceof THREE.Vector3 && obj.position.length())
    result += `position={[${rNbr(obj.position.x)}, ${rNbr(obj.position.y)}, ${rNbr(obj.position.z)},]} `
  if (obj.rotation instanceof THREE.Euler && obj.rotation.toVector3().length())
    result += `rotation={[${rDeg(obj.rotation.x)}, ${rDeg(obj.rotation.y)}, ${rDeg(obj.rotation.z)},]} `
  if (obj.scale instanceof THREE.Vector3 && obj.scale.x !== 1 && obj.scale.y !== 1 && obj.scale.z !== 1)
    result += `scale={[${rNbr(obj.scale.x)}, ${rNbr(obj.scale.y)}, ${rNbr(obj.scale.z)},]} `
  if (options.meta && obj.userData && Object.keys(obj.userData).length)
    result += `userData={${JSON.stringify(obj.userData)}} `

  // Remove empty groups
  if (
    !options.verbose &&
    (type === 'group' || type === 'scene') &&
    (result === oldResult || obj.children.length === 0)
  ) {
    obj.__removed = true
    return children
  }

  // Close tag
  result += `${children.length ? '>' : '/>'}\n`

  // Add children and return
  if (children.length) result += children + `</${type}>${!parent ? '' : '\n'}`
  return result
}

function printAnimations(gltf, animations, options) {
  if (animations.length) {
    return options.types
      ? `\nconst { actions } = useAnimations(animations, group as React.MutableRefObject<THREE.Object3D>)`
      : `\nconst { actions } = useAnimations(animations, group)`
  }

  return ''
}

function parseExtras(extras) {
  if (extras) {
    return (
      Object.keys(extras)
        .map((key) => `${key}: ${extras[key]}`)
        .join('\n') + '\n'
    )
  } else return ''
}

function getRelativeFilePath(file, exportOptions) {
  const filePath = path.resolve(file)
  const rootPath = exportOptions.root ? path.resolve(exportOptions.root) : path.dirname(file)

  const relativePath = path.relative(rootPath, filePath) || ''
  if (process.platform === 'win32') {
    return relativePath.replace(/\\/g, '/')
  }

  return relativePath
}

module.exports = function (file, output, exportOptions) {
  return new Promise((resolve, reject) => {
    Object.keys(exportOptions).forEach((key) => (options[key] = exportOptions[key]))
    const stream = fs.createWriteStream(output)
    stream.once('open', (fd) => {
      if (!fs.existsSync(file)) {
        reject(file + ' does not exist.')
      } else {
        const filePath = getRelativeFilePath(file, exportOptions)
        const data = fs.readFileSync(file)
        const arrayBuffer = toArrayBuffer(data)
        try {
          gltfLoader.parse(
            arrayBuffer,
            '',
            (gltf) => {
              const objects = []
              gltf.scene.traverse((child) => objects.push(child))
              const animations = gltf.animations
              const hasAnimations = animations.length > 0
              const scene = print(objects, gltf, gltf.scene)
              const result = `/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
${parseExtras(gltf.parser.json.asset && gltf.parser.json.asset.extras)}*/
${hasAnimations || options.types ? `\nimport * as THREE from 'three'` : ''}
import React, { useRef${hasAnimations ? ', useState, useEffect' : ''} } from 'react'${
                hasAnimations ? `\nimport { useFrame } from 'react-three-fiber'` : ''
              }
import { useGLTF } from '@react-three/drei/useGLTF'
${scene.includes('PerspectiveCamera') ? `import { PerspectiveCamera } from '@react-three/drei/PerspectiveCamera'` : ''}
${
  scene.includes('OrthographicCamera')
    ? `import { OrthographicCamera } from '@react-three/drei/OrthographicCamera'`
    : ''
}
${hasAnimations ? 'import { useAnimations } from "@react-three/drei/useAnimations"' : ''}
${options.types ? 'import { GLTF } from "three/examples/jsm/loaders/GLTFLoader"' : ''}
${options.types ? printTypes(objects, animations) : ''}
export default function Model(props${options.types ? ": JSX.IntrinsicElements['group']" : ''}) {
  const group = ${options.types ? 'useRef<THREE.Group>()' : 'useRef()'}
  const { nodes, materials${hasAnimations ? ', animations' : ''} } = useGLTF('/${filePath}'${
                options.draco ? `, ${JSON.stringify(options.draco)}` : ''
              })${options.types ? ' as GLTFResult' : ''}${printAnimations(gltf, animations, options)}
  return (
    <group ref={group} {...props} dispose={null}>
${scene}
    </group>
  )
}

useGLTF.preload('/${filePath}'${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})`

              stream.write(
                prettier.format(result, {
                  semi: false,
                  printWidth: 120,
                  singleQuote: true,
                  jsxBracketSameLine: true,
                  parser: options.types ? 'babel-ts' : 'babel',
                })
              )
              stream.end()
              if (options.setLog) setTimeout(() => resolve(), (options.timeout = options.timeout + options.delay))
              else resolve()
            },
            reject
          )
        } catch (e) {
          reject(e)
        }
      }
    })
  })
}
