'use strict'
const React = require('react')
const { Text, Box } = require('ink')
const importJsx = require('import-jsx')
const gltfjsx = require('../gltfjsx')
const ErrorBoundary = importJsx('./ErrorBoundary')

function Conversion({ file, ...config }) {
  let nameExt = file.match(/[-_\w]+[.][\w]+$/i)[0]
  let name = nameExt.split('.').slice(0, -1).join('.')
  let output = name.charAt(0).toUpperCase() + name.slice(1) + (config.types ? '.tsx' : '.js')

  const [done, setDone] = React.useState(false)
  const [log, setLog] = React.useState([])

  React.useEffect(() => {
    async function run() {
      try {
        await gltfjsx(file, output, { ...config, setLog, timeout: 0, delay: 1 })
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
          <Text> {(log[log.length - 1] || '').trim()}</Text>
        </Box>
      )}
      {done && (
        <Box>
          <Text color="black" backgroundColor="green">
            {' Done: '}
          </Text>
          <Text> {output}</Text>
          {config.process && <Text>, {name}-processed.glb</Text>}
        </Box>
      )}
    </>
  )
}

module.exports = function App(props) {
  return (
    <ErrorBoundary>
      <Conversion {...props} />
    </ErrorBoundary>
  )
}
