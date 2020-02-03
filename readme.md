This is an experimental tool that turns GLTF's files into re-usable [react-three-fiber](https://github.com/react-spring/react-three-fiber) JSX components that are very easy to modify and customize.

```bash
npx gltfjsx input.gltf [Output.js] [options]

Options:
  --draco, -d         Adds DRACOLoader                    [boolean]
  --animation, -a     Extracts animation clips            [boolean]
  --compress, -c      Removes names and empty groups      [boolean]
  --precision, -f     Decimal number precision            [number ] [default: 2]
  --help              Show help                           [boolean]
  --version           Show version number                 [boolean]
```

<img src="https://i.imgur.com/DmdTMcL.gif" />

You need to be set up for asset loading and the GLTF has to be present in your /public folder. This tools loads it, creates look-up tables of all the objects and materials inside, and writes out a JSX graph, which you can now alter comfortably.

A typical output looks like this:

```jsx
import React  from 'react'
import { useLoader } from 'react-three-fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'
  
function Model(props) {
  const { nodes, materials } = useLoader(GLTFLoader, '/model.gltf')
  return (
    <group {...props} dispose={null}>
      <scene name="Scene" >
        <object3D name="Camera" position={[10, 0, 50]} rotation={[Math.PI / 2, 0, 0]} >
          <primitive object={nodes['Camera_Orientation']} />
        </object3D>
        <object3D name="Sun" position={[100, 50, 100]} rotation={[-Math.PI / 2, 0, 0]} >
          <primitive object={nodes['Sun_Orientation']} />
        </object3D>
        <group name="Cube" >
          <mesh material={materials['base']} geometry={nodes['Cube.003_0'].geometry} name="Cube.003_0" />
          <mesh material={materials['inner']} geometry={nodes['Cube.003_1'].geometry} name="Cube.003_1" />
        </group>
      </scene>
    </group>
  )
}
```

This component suspends, so you must wrap it into `<Suspense />` for fallbacks and, optionally, error-boundaries for error handling:

```jsx
<ErrorBoundary>
  <Suspense fallback={<Fallback />}>
    <Model />
  </Suspense>
</ErrorBoundary>
```

## --draco

Adds a DRACOLoader, for which you need to be set up. The necessary files have to exist in your /public folder. It defaults to `/draco-gltf/` which should contain [dracos gltf decoder](https://github.com/mrdoob/three.js/tree/dev/examples/js/libs/draco/gltf).

It will then extend the loader-section:

```jsx
const gltf = useLoader(GLTFLoader, '/stork.glb', loader => {
  const dracoLoader = new DRACOLoader()
  dracoLoader.setDecoderPath('/draco-gltf/')
  loader.setDRACOLoader(dracoLoader)
})
```

## --animation

If your GLTF contains animations it will add a THREE.AnimationMixer to your component and extract the clips:


```jsx
const actions = useRef()
const [mixer] = useState(() => new THREE.AnimationMixer())
useFrame((state, delta) => mixer.update(delta))
useEffect(() => {
  actions.current = { storkFly_B_: mixer.clipAction(gltf.animations[0]) }
  return () => gltf.animations.forEach(clip => mixer.uncacheClip(clip))
}, [])
```

If you want to play an animation you can do so at any time:

```jsx
<mesh onClick={e => actions.current.storkFly_B_.play()} />
```
