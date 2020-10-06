'use strict'
const React = require('react')
const { Text, Box } = require('ink')
const { useErrorBoundary } = require('use-error-boundary')

module.exports = function App({ children }) {
  const { ErrorBoundary, didCatch, error } = useErrorBoundary()
  return (
    <>
      {didCatch ? (
        <Box>
          <Text color="white" backgroundColor="red">
            {' '}
            ERROR{' '}
          </Text>
          <Text> {error}</Text>
        </Box>
      ) : (
        <ErrorBoundary>{children}</ErrorBoundary>
      )}
    </>
  )
}
