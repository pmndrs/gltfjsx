import { DRACOLoader, GLTF } from 'node-three-gltf'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  AnalyzedGLTF,
  GenerateOptions,
  GenerateR3F,
  isMesh,
  loadGLTF,
  resolveModelLoadPath,
} from '../../../src/index.js'
import {
  assertFileExists,
  fixtureAnalyzeOptions,
  fixtureGenerateOptions,
  resolveFixtureModelFile,
  types,
} from '../../fixtures.js'

const modelName = 'FlightHelmet'
describe('exposeProps', () => {
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

        describe('no matcher', () => {
          it.concurrent(
            'should generate to[]',
            async () => {
              const mo: GenerateOptions = {
                ...options,
                exposeProps: {
                  shadows: {
                    to: ['castShadow', 'receiveShadow'],
                    structure: {
                      type: 'boolean',
                      hasQuestionToken: true,
                    },
                  },
                },
              }
              const g = new GenerateR3F(a, mo)
              const tsx = await g.toTsx()
              console.log(tsx)
              const jsx = await g.toJsx()

              for (const code of [tsx, jsx]) {
                if (type.includes('instanceall')) {
                  expect(code.match(/<instances/g)?.length).toEqual(6)
                  expect(code.match(/.*receiveShadow=\{shadows\}/g)?.length).toEqual(6)
                  expect(code.match(/.*castShadow=\{shadows\}/g)?.length).toEqual(6)
                } else {
                  expect(code.match(/castShadow=\{shadows\}/g)?.length).toEqual(6)
                  expect(code.match(/receiveShadow=\{shadows\}/g)?.length).toEqual(6)
                }
              }
            },
            10000, // increase timeout for ci - typical timeout if 5000ms
          )

          it.concurrent('should generate to (singular)', async () => {
            const mo: GenerateOptions = {
              ...options,
              exposeProps: {
                shadows: {
                  to: 'castShadow',
                  structure: {
                    type: 'boolean',
                    hasQuestionToken: true,
                  },
                },
              },
            }
            const g = new GenerateR3F(a, mo)
            const tsx = await g.toTsx()
            console.log(tsx)
            const jsx = await g.toJsx()

            for (const code of [tsx, jsx]) {
              if (type.includes('instanceall')) {
                expect(code.match(/<instances\..*castShadow=\{shadows\}/g)?.length).toEqual(6)
                expect(code.match(/<instances\..*receiveShadow /g)?.length).toEqual(6)
              } else {
                expect(code.match(/castShadow=\{shadows\}/g)?.length).toEqual(6)
                expect(code.match(/receiveShadow\n/g)?.length).toEqual(6)
              }
            }
          })
        })

        describe('matcher', () => {
          it.concurrent('should limit matches', async () => {
            const mo: GenerateOptions = {
              ...options,
              exposeProps: {
                shadows: {
                  to: 'castShadow',
                  structure: {
                    type: 'boolean',
                    hasQuestionToken: true,
                  },
                  matcher: (o) => isMesh(o) && o.name === 'GlassPlastic_low',
                },
              },
            }
            const g = new GenerateR3F(a, mo)
            const tsx = await g.toTsx()
            console.log(tsx)
            const jsx = await g.toJsx()

            for (const code of [tsx, jsx]) {
              if (type.includes('instanceall')) {
                expect(
                  code.match(/<instances\.GlassPlastic_low.*castShadow=\{shadows\}/g)?.length,
                ).toEqual(1)
                expect(code.match(/<instances\.GlassPlastic_low.*receiveShadow /g)?.length).toEqual(
                  1,
                )
              } else {
                expect(code.match(/castShadow=\{shadows\}/g)?.length).toEqual(1)
                expect(code.match(/receiveShadow\n/g)?.length).toEqual(6)
              }
            }
          })

          describe('non-existing (non-calculated)', () => {
            // e.g. visible - it may not be present in calculated (because it defaults to true),
            // but we need to be sure we add it to a matched case to ensure propagation
            it.concurrent('should propagate property', async () => {
              const mo: GenerateOptions = {
                ...options,
                exposeProps: {
                  hoseVisible: {
                    to: 'visible',
                    structure: {
                      type: 'boolean',
                      hasQuestionToken: true,
                    },
                    matcher: (o) => isMesh(o) && o.name === 'Hose_low',
                  },
                },
              }
              const g = new GenerateR3F(a, mo)
              const tsx = await g.toTsx()
              console.log(tsx)
              const jsx = await g.toJsx()

              for (const code of [tsx, jsx]) {
                if (type.includes('instanceall')) {
                  expect(
                    code.match(/<instances\.Hose_low.*visible=\{hoseVisible\}/g)?.length,
                  ).toEqual(1)
                } else {
                  expect(code.match(/visible=\{hoseVisible\}/g)?.length).toEqual(1)
                }
              }
            })
          })

          describe('pre-existing (calculated)', () => {
            // provided prop is not `undefined` type or `hasQuestionToken: true`
            it.concurrent('should overwrite required property', async () => {
              const mo: GenerateOptions = {
                ...options,
                exposeProps: {
                  hoseMaterial: {
                    to: 'material',
                    structure: {
                      type: 'Material',
                    },
                    matcher: (o) => isMesh(o) && o.name === 'Hose_low',
                  },
                },
              }
              const g = new GenerateR3F(a, mo)
              const tsx = await g.toTsx()
              console.log(tsx)
              const jsx = await g.toJsx()

              for (const code of [tsx, jsx]) {
                if (type.includes('instanceall')) {
                  expect(
                    code.match(/<instances\.Hose_low.*material=\{hoseMaterial\}/g)?.length,
                  ).toEqual(1)
                } else {
                  expect(code.match(/material=\{hoseMaterial\}/g)?.length).toEqual(1)
                }
              }
            })

            describe('optional fallback', () => {
              async function assertFallback(g: GenerateR3F) {
                const tsx = await g.toTsx()
                console.log(tsx)
                const jsx = await g.toJsx()

                for (const code of [tsx, jsx]) {
                  if (type.includes('instanceall')) {
                    expect(
                      code.match(/<instances\.Hose_low.*material=\{hoseMaterial\}/g)?.length,
                    ).toEqual(1)
                  } else {
                    expect(
                      code.match(/material=\{hoseMaterial \|\| materials.HoseMat\}/g)?.length,
                    ).toEqual(1)
                  }
                }
              }

              it.concurrent('should override property with hasQuestionToken', async () => {
                const mo: GenerateOptions = {
                  ...options,
                  exposeProps: {
                    hoseMaterial: {
                      to: 'material',
                      structure: {
                        type: 'Material',
                        hasQuestionToken: true,
                      },
                      matcher: (o) => isMesh(o) && o.name === 'Hose_low',
                    },
                  },
                }
                const g = new GenerateR3F(a, mo)
                await assertFallback(g)
              })

              it.concurrent('should override property with type contains undefined', async () => {
                const mo: GenerateOptions = {
                  ...options,
                  exposeProps: {
                    hoseMaterial: {
                      to: 'material',
                      structure: {
                        type: 'Material | undefined',
                      },
                      matcher: (o) => isMesh(o) && o.name === 'Hose_low',
                    },
                  },
                }
                const g = new GenerateR3F(a, mo)
                await assertFallback(g)
              })
            })
          })
        })
      })
    }
  })
})
