'use strict'
const React = require('react')
const { Text, Box } = require('ink')
const importJsx = require('import-jsx')
const fg = require('fast-glob')
const fs = require('fs-extra')
const gltfjsx = require('../gltfjsx')
const ErrorBoundary = importJsx('./ErrorBoundary')

fs.removeSync('.test')
fs.mkdirSync('.test')

const config = { types: false, precision: 2, verbose: false, draco: undefined, silent: true }
const entries = fg.sync(['node_modules/glTF-Sample-Models/2.0/**/*.{gltf,glb}'], { dot: true })

function TestGltfs() {
  const [file, setFile] = React.useState()
  const [done, setDone] = React.useState(false)
  const [log, setLog] = React.useState([])

  React.useEffect(() => {
    async function run() {
      try {
        for (let file of entries) {
          let nameExt = file.match(/[-_\w]+[.][\w]+$/i)[0]
          let output = '.test/' + nameExt.charAt(0).toUpperCase() + nameExt.slice(1) + (config.types ? '.tsx' : '.js')
          setFile(nameExt)
          await gltfjsx(file, output, { ...config, setLog, timeout: 0, delay: 0 })
        }
        fs.removeSync('.test')
        setDone(true)
      } catch (e) {
        setDone(() => {
          throw e
        })
      }
    }
    run()
  }, [])

  return (
    <>
      {!done && (
        <Box>
          <Text color="black" backgroundColor="white">
            {' Parse '}
          </Text>
          <Text> {file}</Text>
          <Text> {(log[log.length - 1] || '').trim()}</Text>
        </Box>
      )}
      {done && (
        <Box>
          <Text color="black" backgroundColor="green">
            {' Done: '}
          </Text>
          <Text> No errors</Text>
        </Box>
      )}
    </>
  )
}

module.exports = function App() {
  return (
    <ErrorBoundary>
      <TestGltfs />
    </ErrorBoundary>
  )
}
