import { GLTF } from 'three/examples/jsm/loaders/GLTFLoader'

export function transform(
  file: string,
  output: string,
  config?: {
    resolution?: number
    simplify?: boolean
    weld?: number
    ratio?: number
    error?: number
  }
): Promise<void>

export function parse(
  fileName: string,
  gltf: GLTF,
  options?: {
    instanceall?: boolean
    instance?: boolean
    precision?: number
    shadows?: boolean
    meta?: boolean
    keepgroups?: boolean
    keepnames?: boolean
    types?: boolean
    debug?: boolean
    header?: string
    draco?: object
  }
): string
