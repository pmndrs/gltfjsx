#!/usr/bin/env node
const fs = require('fs')
const Path = require('path')
const gltfjsx = require('./gltfjsx')
const version = require('./package.json').version

const argv = require('yargs').usage('node batchgltfs.js [batchgltf.json]').help().argv
let file = 'batchgltf.json'
if (argv._[0]) {
  file = argv._[0]
}
file = Path.join(process.cwd(), file)

/**
 * TODO - what happens if using same gltf for assets with and without draco compression prop?
 */
fs.readFile(file, (err, data) => {
  if (err) throw err
  let settings = JSON.parse(data)
  console.log(`|-----------------------------------------------------------|`)
  console.log(`   Process assets in batchgltf.json`)
  console.log(`|-----------------------------------------------------------|`)
  // incase you were wondering about below. https://css-tricks.com/why-using-reduce-to-sequentially-resolve-promises-works/
  let result = settings.assets.reduce((accumulatorPromise, asset) => {
    return accumulatorPromise.then(() => {
      return convert(asset, settings).then(() => {
        copyGltfToPublicFolder(asset.gltf, Path.join(process.cwd(), settings.publicDir))
      })
    })
  }, Promise.resolve())
  result.then((r) => {
    console.log(`|-----------------------------------------------------------|`)
    console.log(`   All assets converted.`)
    console.log(`|-----------------------------------------------------------|`)
  })
})

const fileDetails = (filePath) => {
  // console.log(`File Details:`);
  // console.log(`    src: ${filePath}`);
  // console.log(`    name & etc: ${Path.basename(filePath)}`);
  // console.log(`    name: ${Path.parse(filePath).name}`);
  // console.log(`    ext: ${Path.extname(filePath)}`);
  // console.log(`    folder: ${Path.dirname(filePath)}`);
  return {
    src: filePath,
    name: Path.parse(filePath).name,
    fullName: Path.basename(filePath),
    ext: Path.extname(filePath),
    folder: Path.dirname(filePath),
  }
}

const convert = (asset, settings) => {
  return new Promise((resolve, reject) => {
    const options = { ...settings.defaultOptions, ...asset.options }
    const fd_src = fileDetails(asset.gltf)
    const fd_dst = fileDetails(Path.join(process.cwd(), settings.srcDir, asset.className))
    let gltfClass = Path.join(fd_dst.folder, fd_dst.name + (options.types ? '.tsx' : '.js'))
    console.log(`|-----------------------------------------------------------|`)
    console.log(`   Converting`)
    console.log(`|-----------------------------------------------------------|`)
    console.log(`gltfjsx ${version}`)
    console.log(`converting ${fd_src.fullName}`)
    console.log(`to ${gltfClass}`)
    console.log(`to with options: ${JSON.stringify(options, null, 2)}`)

    // Validate destination folder for src files.
    try {
      if (!fs.existsSync(fd_dst.folder)) {
        fs.mkdirSync(fd_dst.folder, { recursive: true })
      }
    } catch (err) {
      console.error('ERROR: Failed to check and create jsx folder destination \r', err)
      reject()
    }

    // Go ahead and create jsx
    gltfjsx(fd_src.src, fd_src.fullName, gltfClass, options)
      .then(() => {
        console.log(`|-----------------------------------------------------------|`)
        console.log('   Conversion done.')
        console.log(`|-----------------------------------------------------------|`)
      })
      .then(() => {
        resolve()
      })
      .catch((err) => {
        console.error(`|-----------------------------------------------------------|`)
        console.error(' Conversion failed.\n\n', err)
        console.error(`|-----------------------------------------------------------|`)
        reject()
      })
  })
}

/**
 * Todo wrap into promise properly
 * @param src
 * @param dst
 */
const copyGltfToPublicFolder = (src, dst) => {
  const fd_src = fileDetails(src)
  const fileDst = Path.join(dst, fd_src.fullName)
  console.log(`|-----------------------------------------------------------|`)
  console.log(`   Copy Asset : ${fd_src.fullName} to ${fileDst}`)
  console.log(`|-----------------------------------------------------------|`)
  let doCopy = true

  // Check if file already exists and if its changed then do copy.
  try {
    if (fs.existsSync(fileDst)) {
      const targetFile = fs.readFileSync(fileDst)
      const srcFile = fs.readFileSync(src)
      if (targetFile.equals(srcFile)) {
        console.info('SKIPPING: file exists and is same as src')
        doCopy = false
      }
    } else {
    }
  } catch (err) {
    console.error('ERROR: Failed comparison check between src & dst. \r', err)
  }

  // Copy gltf to public directory.
  if (doCopy) {
    fs.copyFile(src, fileDst, (err) => {
      if (err) throw err
      console.log(`COMPLETE: ${src} was copied to ${dst}`)
      console.error(`|-----------------------------------------------------------|`)
    })
  }
}
