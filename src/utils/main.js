const parse = require('./parser')
const GLTFLoader = require('./glftLoader')

module.exports = {
  parse,
  GLTFStructureLoader: GLTFLoader
}