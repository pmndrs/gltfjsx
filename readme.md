# npx gltfjsx

An experimental tool that turns GLTF's file into a JSX components.

```bash
npx gltfjsx input.gltf [Output.js] [options]

Options:
  --draco, -d      adds DRACOLoader                   [string] [default: "/draco-gltf/"]
  --animation, -a  extracts animation clips           [boolean]
  --help           Show help                          [boolean]
  --version        Show version number                [boolean]
```

<img src="https://i.imgur.com/U4cWrNN.gif" />

You need to be set up for asset loading and the actual GLTF has to be present in your /public folder. This tools loads it, creates a hashmap of all the objects inside and writes out a JSX tree which you can now freely alter.

A typical output looks like this:

```jsx
import React from 'react'
import { useLoader } from 'react-three-fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export default function Model(props) {
  const [gltf, objects] = useLoader(GLTFLoader, '/scene.glb')
  return (
    <group {...props}>
      <scene name="Scene">
        <mesh name="Cube000" position={[0.3222085237503052, 2.3247640132904053, 10.725556373596191]}>
          <bufferGeometry attach="geometry" {...objects[1].geometry} />
          <meshStandardMaterial attach="material" {...objects[1].material} name="sillones" />
        </mesh>
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
const [gltf, objects] = useLoader(GLTFLoader, '/stork.glb', loader => {
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