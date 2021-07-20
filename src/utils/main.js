const parse = require('./parser')
const transform = require('./transform')
const GLTFLoader = require('./glftLoader')

module.exports = {
  transform,
  parse,
  GLTFStructureLoader: GLTFLoader,
}
