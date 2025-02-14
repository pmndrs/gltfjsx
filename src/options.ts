import { SimplifyOptions, TextureCompressOptions } from '@gltf-transform/functions'
import { Object3D } from 'three'
import { OptionalKind, PropertySignatureStructure } from 'ts-morph'

import { AnalyzedGLTF } from './analyze/index.js'
import { WithOptional } from './utils/index.js'

export interface LogOptions {
  silent: boolean
  debug: boolean
}

export type LogFn = (...args: any[]) => void

export interface Logger {
  debug: LogFn
  info: LogFn
  warn: LogFn
  error: LogFn

  isDebugEnabled: () => boolean
}

interface BaseOptions {
  instance?: boolean
  instanceall?: boolean
  keepgroups?: boolean
  keepnames?: boolean
  log: Logger
}

export interface TransformOptions extends BaseOptions {
  degrade?: string
  /** default 512 */
  degraderesolution?: number

  /** default: true */
  flatten?: boolean
  format: TextureCompressOptions['targetFormat']

  keepattributes?: boolean
  keepmaterials?: boolean
  keepmeshes?: boolean

  /** default 1024 */
  resolution?: number

  /**
   * Simplify meshes via @gltf-transform/extensions
   *
   * If true/no options specified, defaults apply:
   *  - error: 0.001
   *  - ratio: 0.75
   */
  simplify?: boolean | WithOptional<SimplifyOptions, 'simplifier'>
}

export interface PropsOptions extends BaseOptions {
  bones?: boolean
  meta?: boolean
  shadows?: boolean
}

export interface AnalyzedGLTFOptions extends PropsOptions {
  precision?: number
}

export type Matcher = (o: Object3D, a: AnalyzedGLTF) => boolean

export type ExposePropStructure = Omit<OptionalKind<PropertySignatureStructure>, 'name'>

export interface ExposedProp {
  /**
   * Object3D prop(s)
   * e.g. castShadow | [castShadow, receiveShadow]
   * */
  to: string | string[]
  /**
   * Match a specific type of object.
   * If not provided, matches all that have the {to} prop
   * */
  matcher?: Matcher
  /**
   * ts-morph prop type structure (name is already supplied)
   * e.g.
   *    structure: {
   *      type: 'boolean',
   *      hasQuestionToken: true,
   *    },
   * */
  structure: ExposePropStructure
}

export interface GenerateOptions extends PropsOptions {
  /**
   * Set the component name (default: 'Model') which also
   *  is used to determine the
   */
  componentName: string
  /**
   * Use draco compression in useGLTF()
   */
  draco?: boolean
  /**
   * Export the component as default
   */
  exportDefault?: boolean
  /**
   * Set the source file header
   */
  header?: string
  /**
   * Expose component prop and propagate to matching Object3D props
   * e.g. shadows->[castShadow, receiveShadow]
   */
  exposeProps?: Record<string, ExposedProp>
  /**
   * Load path for the model for useGLTF()
   */
  modelLoadPath: string
  /**
   * file size to include in auto-generated header (assuming header option is undefined)
   */
  size?: string // human readable size
}

export interface CliOptions
  extends Omit<TransformOptions, 'log'>,
    Omit<GenerateOptions, 'componentName' | 'modelLoadPath' | 'log'>,
    Omit<AnalyzedGLTFOptions, 'log'> {
  console: boolean
  debug: boolean
  output?: string
  root?: string
  transform?: boolean
  types: boolean
}
