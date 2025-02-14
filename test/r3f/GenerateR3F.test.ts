import { DRACOLoader, GLTF } from 'node-three-gltf'
import { SyntaxKind } from 'ts-morph'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  AnalyzedGLTF,
  GenerateOptions,
  GenerateR3F,
  loadGLTF,
  resolveModelLoadPath,
} from '../../src/index.js'
import {
  assertFileExists,
  fixtureAnalyzeOptions,
  fixtureGenerateOptions,
  resolveFixtureModelFile,
  types,
} from '../fixtures.js'

const modelName = 'FlightHelmet'
describe('GenerateR3F', () => {
  describe(modelName, () => {
    for (const type of types) {
      const modelFile = resolveFixtureModelFile(modelName, type)
      describe(type, () => {
        let model: GLTF
        let options: GenerateOptions
        let a: AnalyzedGLTF
        let dracoLoader: DRACOLoader

        beforeAll(async () => {
          dracoLoader = new DRACOLoader()
          assertFileExists(modelFile)
          model = await loadGLTF(modelFile, dracoLoader)
          options = fixtureGenerateOptions({
            componentName: modelName,
            draco: type.includes('draco'),
            header: 'FOO header',
            modelLoadPath: resolveModelLoadPath(modelFile, '/public/models'),
            // types: true,
            keepnames: true,
            shadows: true,
            instanceall: type.includes('instanceall'),
          })
          a = new AnalyzedGLTF(model, fixtureAnalyzeOptions(options))
        })
        afterAll(() => {
          dracoLoader.dispose()
        })

        // beforeEach(async () => {
        // })

        function assertCommon(g: GenerateR3F) {
          expect(g.project).not.toBeNull()
          expect(g.src).not.toBeNull()
          expect(g.gltfInterface).not.toBeNull()
          expect(g.propsInterface).not.toBeNull()
          expect(g.instancesFn).not.toBeNull()
          expect(g.fn).not.toBeNull()
          expect(g.groupRoot).not.toBeNull()
          expect(g.groupRoot.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement).length).toEqual(
            6,
          )
        }

        function assertInstanceAllCommon(code: string) {
          expect(code).toContain('<Merged')
          expect(code).toContain('const instances = React.useMemo(')
        }

        it.concurrent('should generate', async () => {
          const g = new GenerateR3F(a, options)

          const tsx = await g.toTsx()
          console.log(tsx)
          const jsx = await g.toJsx()
          assertCommon(g)

          for (const code of [tsx, jsx]) {
            expect(code).toContain('FOO header')

            if (type.includes('instanceall')) {
              assertInstanceAllCommon(code)
              expect(code.match(/<instances\..*castShadow/g)?.length).toEqual(6)
              expect(code.match(/<instances\..*receiveShadow/g)?.length).toEqual(6)
            } else {
              expect(code.match(/castShadow/g)?.length).toEqual(6)
              expect(code.match(/receiveShadow/g)?.length).toEqual(6)
            }
          }
        })
      })
    }
  })
})
