import * as THREE from 'three'
import React, { useEffect, useRef } from 'react'
import { useLoader, useFrame } from 'react-three-fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader'

export default function Model(props) {
  const group = useRef()
  const gltf = useLoader(GLTFLoader, '/scene.gltf')

  return (
    <group ref={group} {...props}>
      <scene name="OSG_Scene">
        <object3D name="RootNode_(gltf_orientation_matrix)" rotation={[-1.5707963267948963, 0, 0]}>
          <object3D name="RootNode_(model_correction_matrix)">
            <object3D name="bd81465a84094d68b79f9d9d8cdf820bfbx" rotation={[1.5707963267948963, 0, 0]}>
              <object3D name="RootNode">
                <object3D name="NewspaperFolded">
                  <mesh name="NewspaperFolded_Newspaper_0">
                    <bufferGeometry attach="geometry" {...gltf.__$[6].geometry} />
                    <meshStandardMaterial attach="material" {...gltf.__$[6].material} name="Newspaper" />
                  </mesh>
                </object3D>
              </object3D>
            </object3D>
          </object3D>
        </object3D>
      </scene>
    </group>
  )
}
