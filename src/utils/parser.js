const THREE = require('three')
const isVarName = require('./isVarName')

function parse(fileName, gltf, options = {}) {
  const url = (fileName.toLowerCase().startsWith('http') ? '' : '/') + fileName
  const animations = gltf.animations
  const hasAnimations = animations.length > 0

  // Collect all objects
  const objects = []
  gltf.scene.traverse((child) => objects.push(child))

  // Browse for duplicates
  const duplicates = {
    names: {},
    materials: {},
    geometries: {},
  }

  function uniqueName(attempt, index = 0) {
    const newAttempt = index > 0 ? attempt + index : attempt
    if (Object.values(duplicates.geometries).find(({ name }) => name === newAttempt) === undefined) return newAttempt
    else return uniqueName(attempt, index + 1)
  }

  gltf.scene.traverse((child) => {
    if (child.isMesh) {
      if (child.material) {
        if (!duplicates.materials[child.material.name]) {
          duplicates.materials[child.material.name] = 1
        } else {
          duplicates.materials[child.material.name]++
        }
      }
      if (child.geometry) {
        if (!duplicates.geometries[child.geometry.uuid]) {
          let name = (child.name || 'Part').replace(/[^a-zA-Z]/g, '')
          name = name.charAt(0).toUpperCase() + name.slice(1)
          duplicates.geometries[child.geometry.uuid] = {
            count: 1,
            name: uniqueName(name),
            node: 'nodes' + sanitizeName(child.name),
          }
        } else {
          duplicates.geometries[child.geometry.uuid].count++
        }
      }
    }
  })

  // Prune duplicate geometries
  if (!options.instanceall) {
    for (let key of Object.keys(duplicates.geometries)) {
      const duplicate = duplicates.geometries[key]
      if (duplicate.count === 1) delete duplicates.geometries[key]
    }
  }

  const hasInstances = (options.instance || options.instanceall) && Object.keys(duplicates.geometries).length > 0

  function sanitizeName(name) {
    return isVarName(name) ? `.${name}` : `['${name}']`
  }

  const rNbr = (number) => {
    return parseFloat(number.toFixed(Math.round(options.precision || 2)))
  }

  const rDeg = (number) => {
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

  function getType(obj) {
    let type = obj.type.charAt(0).toLowerCase() + obj.type.slice(1)
    // Turn object3d's into groups, it should be faster according to the threejs docs
    if (type === 'object3D') type = 'group'
    if (type === 'perspectiveCamera') type = 'PerspectiveCamera'
    if (type === 'orthographicCamera') type = 'OrthographicCamera'
    return type
  }

  function handleProps(obj) {
    let { type, node, instanced, animated } = getInfo(obj)

    let result = ''
    let isCamera = type === 'PerspectiveCamera' || type === 'OrthographicCamera'
    // Handle cameras
    if (isCamera) {
      result += `makeDefault={false} `
      if (obj.zoom !== 1) result += `zoom={${rNbr(obj.zoom)}} `
      if (obj.far !== 2000) result += `far={${rNbr(obj.far)}} `
      if (obj.near !== 0.1) result += `near={${rNbr(obj.near)}} `
    }
    if (type === 'PerspectiveCamera') {
      if (obj.fov !== 50) result += `fov={${rNbr(obj.fov)}} `
    }

    if (!instanced) {
      // Shadows
      if (type === 'mesh' && options.shadows) result += `castShadow receiveShadow `

      // Write out geometry first
      if (obj.geometry) {
        result += `geometry={${node}.geometry} `
      }

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
      if (obj.intensity && rNbr(obj.intensity)) result += `intensity={${rNbr(obj.intensity)}} `
      //if (obj.power && obj.power !== 4 * Math.PI) result += `power={${rNbr(obj.power)}} `
      if (obj.angle && obj.angle !== Math.PI / 3) result += `angle={${rDeg(obj.angle)}} `
      if (obj.penumbra && rNbr(obj.penumbra) !== 0) result += `penumbra={${rNbr(obj.penumbra)}} `
      if (obj.decay && rNbr(obj.decay) !== 1) result += `decay={${rNbr(obj.decay)}} `
      if (obj.distance && rNbr(obj.distance) !== 0) result += `distance={${rNbr(obj.distance)}} `
      if (obj.up && obj.up.isVector3 && !obj.up.equals(new THREE.Vector3(0, 1, 0)))
        result += `up={[${rNbr(obj.up.x)}, ${rNbr(obj.up.y)}, ${rNbr(obj.up.z)},]} `
    }

    if (obj.color && obj.color.getHexString() !== 'ffffff') result += `color="#${obj.color.getHexString()}" `
    if (obj.position && obj.position.isVector3 && rNbr(obj.position.length()))
      result += `position={[${rNbr(obj.position.x)}, ${rNbr(obj.position.y)}, ${rNbr(obj.position.z)},]} `
    if (obj.rotation && obj.rotation.isEuler && rNbr(obj.rotation.toVector3().length()))
      result += `rotation={[${rDeg(obj.rotation.x)}, ${rDeg(obj.rotation.y)}, ${rDeg(obj.rotation.z)},]} `
    if (
      obj.scale &&
      obj.scale.isVector3 &&
      !(rNbr(obj.scale.x) === 1 && rNbr(obj.scale.y) === 1 && rNbr(obj.scale.z) === 1)
    ) {
      const rX = rNbr(obj.scale.x)
      const rY = rNbr(obj.scale.y)
      const rZ = rNbr(obj.scale.z)
      if (rX === rY && rX === rZ) {
        result += `scale={${rX}} `
      } else {
        result += `scale={[${rX}, ${rY}, ${rZ},]} `
      }
    }
    if (options.meta && obj.userData && Object.keys(obj.userData).length)
      result += `userData={${JSON.stringify(obj.userData)}} `

    return result
  }

  function getInfo(obj) {
    let type = getType(obj)
    let node = 'nodes' + sanitizeName(obj.name)
    let instanced =
      (options.instance || options.instanceall) &&
      obj.geometry &&
      duplicates.geometries[obj.geometry.uuid] &&
      duplicates.geometries[obj.geometry.uuid].count > (options.instanceall ? 0 : 1)
    let animated = gltf.animations && gltf.animations.length > 0
    return { type, node, instanced, animated }
  }

  function print(objects, gltf, obj, inject = '') {
    let result = ''
    let children = ''
    let { type, node, instanced, animated } = getInfo(obj)

    if (options.setLog)
      setTimeout(
        () => options.setLog((state) => [...state, obj.name]),
        (options.timeout = options.timeout + options.delay)
      )

    // Bail out on lights and bones
    if (type === 'bone') {
      return `<primitive object={${node}} />`
    }

    // Collect children
    if (obj.children) obj.children.forEach((child) => (children += print(objects, gltf, child)))

    if (instanced) {
      result = `<instances.${duplicates.geometries[obj.geometry.uuid].name} `
    } else {
      // Form the object in JSX syntax
      result = `<${type} `
    }

    // Include names when output is uncompressed or morphTargetDictionaries are present
    if (obj.name.length && (options.keepnames || obj.morphTargetDictionary || animated)) result += `name="${obj.name}" `

    const oldResult = result

    result += handleProps(obj)

    // Prune ...
    if (!options.keepgroups && !animated && (type === 'group' || type === 'scene')) {
      /** Empty or no-property groups
       *
       * <group>
       *   <mesh geometry={nodes.foo} material={materials.bar} />
       */
      if (result === oldResult || obj.children.length === 0) {
        console.log('group removed (empty)')
        obj.__removed = true
        return children
      }

      if (options.aggressive) {
        function equalOrNegated(a, b) {
          return (a.x === b.x || a.x === -b.x) && (a.y === b.y || a.y === -b.y) && (a.z === b.z || a.z === -b.z)
        }

        // More aggressive removal strategies ...
        const first = obj.children[0]
        const firstProps = handleProps(first)
        const regex = /([a-z-A-Z]*)={([a-zA-Z0-9\.\[\]\-\,\ \/]*)}/g
        const keys1 = [...result.matchAll(regex)].map(([, match]) => match)
        const values1 = [...result.matchAll(regex)].map(([, , match]) => match)
        const keys2 = [...firstProps.matchAll(regex)].map(([, match]) => match)

        /** Double negative transforms
         *
         * <group rotation={[-Math.PI / 2, 0, 0]}>
         *   <group rotation={[Math.PI / 2, 0, 0]}>
         *     <mesh geometry={nodes.foo} material={materials.bar} />
         */
        if (obj.children.length === 1 && getType(first) === type && equalOrNegated(obj.rotation, first.rotation)) {
          if (keys1.length === 1 && keys2.length === 1 && keys1[0] === 'rotation' && keys2[0] === 'rotation') {
            console.log('group removed (double negative rotation)')
            obj.__removed = first.__removed = true
            children = ''
            if (first.children) first.children.forEach((child) => (children += print(objects, gltf, child)))
            return children
          }
        }

        /** Transform overlap
         *
         * <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
         *   <mesh geometry={nodes.foo} material={materials.bar} />
         */
        const isChildTransformed = keys2.includes('position') || keys2.includes('rotation') || keys2.includes('scale')
        const hasOtherProps = keys1.some((key) => !['position', 'scale', 'rotation'].includes(key))
        if (obj.children.length === 1 && !isChildTransformed && !hasOtherProps) {
          console.log(`group removed (${keys1.join(' ')} overlap)`)
          children = print(objects, gltf, first, keys1.map((key, i) => `${key}={${values1[i]}}`).join(' '))
          obj.__removed = true
          return children
        }

        /** Lack of content
         *
         * <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
         *   <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]}>
         *     <group position={[10, 0, 0]} scale={2} rotation={[-Math.PI / 2, 0, 0]} />
         */
        const empty = []
        obj.traverse((o) => {
          console.log('group removed (lack of content)')
          const type = getType(o)
          if (type !== 'group' && type !== 'object3D') empty.push(o)
        })
        if (!empty.length) {
          empty.forEach((o) => (o__removed = true))
          return ''
        }
      }
    }

    // Inject properties
    result += ' ' + inject + ' '

    // Close tag
    result += `${children.length ? '>' : '/>'}\n`

    // Add children and return
    if (children.length) result += children + `</${type}>`
    return result
  }

  function printAnimations(animations) {
    return animations.length
      ? `\nconst { actions } = useAnimations${options.types ? '<GLTFActions>' : ''}(animations, group)`
      : ''
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

  function p(obj, line) {
    console.log(
      [...new Array(line * 2)].map(() => ' ').join(''),
      obj.type,
      obj.name,
      'pos:',
      obj.position.toArray().map(rNbr),
      'scale:',
      obj.scale.toArray().map(rNbr),
      'rot:',
      [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(rNbr),
      'mat:',
      obj.material ? `${obj.material.name}-${obj.material.uuid.substring(0, 8)}` : ''
    )
    obj.children.forEach((o) => p(o, line + 1))
  }

  if (options.debug) p(gltf.scene, 0)

  const scene = print(objects, gltf, gltf.scene)
  return `/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
${parseExtras(gltf.parser.json.asset && gltf.parser.json.asset.extras)}*/
        ${options.types ? `\nimport * as THREE from 'three'` : ''}
        import React, { useRef ${hasInstances ? ', useMemo' : ''} } from 'react'
        import { useGLTF, ${hasInstances ? 'Merged, ' : ''} ${
    scene.includes('PerspectiveCamera') ? 'PerspectiveCamera,' : ''
  }
        ${scene.includes('OrthographicCamera') ? 'OrthographicCamera,' : ''}
        ${hasAnimations ? 'useAnimations' : ''} } from '@react-three/drei'
        ${options.types ? 'import { GLTF } from "three-stdlib"' : ''}
        ${options.types ? printTypes(objects, animations) : ''}

        ${
          hasInstances
            ? `
        export default function InstancedModel(props) {
          const { nodes } = useGLTF('${url}'${options.draco ? `, ${JSON.stringify(options.draco)}` : ''})${
                options.types ? ' as GLTFResult' : ''
              }
          const instances = useMemo(() => ({
            ${Object.values(duplicates.geometries)
              .map((v) => `${v.name}: ${v.node}`)
              .join(', ')}
          }), [nodes])
          return (
            <Merged meshes={instances} {...props}>
              {(instances) => <Model instances={instances} />}
            </Merged>
          )
        }
        `
            : ''
        }

        ${hasInstances ? '' : 'export default'} function Model({ ${hasInstances ? 'instances, ' : ''}...props }${
    options.types ? ": JSX.IntrinsicElements['group']" : ''
  }) {
          const group = ${options.types ? 'useRef<THREE.Group>()' : 'useRef()'}
          const { nodes, materials${hasAnimations ? ', animations' : ''} } = useGLTF('${url}'${
    options.draco ? `, ${JSON.stringify(options.draco)}` : ''
  })${options.types ? ' as GLTFResult' : ''}${printAnimations(animations)}
          return (
            <group ref={group} {...props} dispose={null}>
        ${scene}
            </group>
          )
        }

useGLTF.preload('${url}')`
}

module.exports = parse
