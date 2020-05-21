![](https://i.imgur.com/ZB4uUaz.png)

Turns GLTF files into re-usable [react-three-fiber](https://github.com/react-spring/react-three-fiber) JSX components. See it in action here: https://twitter.com/0xca0a/status/1224335000755146753

The usual GLTF workflow yields a static blob that you drop into the scene, this makes dynamic modifications cumbersome since objects can only be found back by traversal. With gltfjsx the full graph is under your control, you can add shadows, events, bind materials to state, make contents conditional, remove or swap out parts, change parent-child relations, etc.

### Usage

```bash
$ npx gltfjsx model.gltf [Model.js] [options]
```

### Options
```bash
  --draco, -d         Adds draco-Loader                   [boolean]
  --animation, -a     Extracts animation clips            [boolean]
  --types, -t         Adds Typescript definitions         [boolean]
  --compress, -c      Removes names and empty groups      [boolean] [default: true]
  --precision, -p     Number of fractional digits         [number ] [default: 2]
  --binary, -b        Draco binaries                      [string ] [default: '/draco-gltf/']
  --help              Show help                           [boolean]
  --version           Show version number                 [boolean]
```

You need to be set up for asset loading and the GLTF has to be present in your /public folder. This tools loads it, creates look-up tables of all the objects and materials inside, and writes out a JSX graph, which you can now alter comfortably. It will not change or alter your files in any way otherwise.

A typical result will look like this:

```jsx
/*
auto-generated by: https://github.com/react-spring/gltfjsx
author: abcdef (https://sketchfab.com/abcdef)
license: CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)
source: https://sketchfab.com/models/...
title: Model
*/

import React from 'react'
import { useLoader } from 'react-three-fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

function Model(props) {
  const { nodes, materials } = useLoader(GLTFLoader, '/model.gltf')
  return (
    <group {...props} dispose={null}>
      <group name="Camera" position={[10, 0, 50]} rotation={[Math.PI / 2, 0, 0]}>
        <primitive object={nodes.Camera_Orientation} />
      </group>
      <group name="Sun" position={[100, 50, 100]} rotation={[-Math.PI / 2, 0, 0]}>
        <primitive object={nodes.Sun_Orientation} />
      </group>
      <group name="Cube">
        <mesh material={materials.base} geometry={nodes.Cube_003_0.geometry} />
        <mesh material={materials.inner} geometry={nodes.Cube_003_1.geometry} />
      </group>
    </group>
  )
}
```

This component is async and must be wrapped into `<Suspense>` for fallbacks:

```jsx
import React, { Suspense } from 'react'

function App() {
  return (
    <Suspense fallback={null}>
      <Model />
    </Suspense>
```

### --draco

Adds a DRACOLoader, for which you need to be set up. The necessary files have to exist in your /public folder. It defaults to `/draco-gltf/` which should contain [dracos gltf decoder](https://github.com/mrdoob/three.js/tree/dev/examples/js/libs/draco/gltf). It uses the draco shortcut from the [drei](https://github.com/react-spring/drei) library, which needs to be present in your package.json.

Your model will look like this:

```jsx
import { draco } from 'drei'

function Model(props) {
  const { nodes, materials } = useLoader(GLTFLoader, '/model.gltf', draco('/draco-gltf/'))
```

### --animation

If your GLTF contains animations it will add a THREE.AnimationMixer to your component and extract the clips:

```jsx
const actions = useRef()
const [mixer] = useState(() => new THREE.AnimationMixer())
useFrame((state, delta) => mixer.update(delta))
useEffect(() => {
  actions.current = { storkFly_B_: mixer.clipAction(gltf.animations[0]) }
  return () => gltf.animations.forEach((clip) => mixer.uncacheClip(clip))
}, [])
```

If you want to play an animation you can do so at any time:

```jsx
<mesh onClick={(e) => actions.current.storkFly_B_.play()} />
```

### --types

This will make your GLTF typesafe.

```tsx
type GLTFResult = GLTF & {
  nodes: {
    cube1: THREE.Mesh
    cube2: THREE.Mesh
  }
  materials: {
    base: THREE.MeshStandardMaterial
    inner: THREE.MeshStandardMaterial
  }
}

function Model(props: JSX.IntrinsicElements['group']) {
  const { nodes, materials } = useLoader<GLTFResult>(GLTFLoader, '/model.gltf')
```

## Release notes and breaking changes

https://github.com/react-spring/gltfjsx/blob/master/whatsnew.md
