// Audit-only diagnostic. No scaling: keep source pixels and top-align canvases.
// BUNDLED_NODE_MODULES points at the desktop tool runtime, not project dependencies.
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

async function main() {
  const [reference, actual, outputPrefix] = process.argv.slice(2)
  if (!reference || !actual || !outputPrefix || !process.env.BUNDLED_NODE_MODULES) {
    throw new Error('Usage: BUNDLED_NODE_MODULES=... node compare-images.cjs reference actual output-prefix')
  }
  const modules = process.env.BUNDLED_NODE_MODULES
  const sharp = require(path.join(modules, 'sharp'))
  const { default: pixelmatch } = await import(pathToFileURL(require.resolve(path.join(modules, 'pixelmatch'))).href)
  const left = await sharp(reference).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const right = await sharp(actual).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  if (left.info.width !== right.info.width) throw new Error('Widths differ; do not resize screenshots to manufacture comparability')
  const width = left.info.width
  const height = Math.max(left.info.height, right.info.height)
  const overlapHeight = Math.min(left.info.height, right.info.height)
  const background = { r: 255, g: 252, b: 247, alpha: 1 }
  const pad = image => sharp(image.data, { raw: image.info }).extend({ top: 0, bottom: height - image.info.height, left: 0, right: 0, background }).raw().toBuffer()
  const [a, b] = await Promise.all([pad(left), pad(right)])
  const diff = Buffer.alloc(width * height * 4)
  const options = { threshold: 0.1, includeAA: false, diffColor: [224, 0, 80] }
  const differingPixels = pixelmatch(a, b, diff, width, height, options)
  const overlapDiff = Buffer.alloc(width * overlapHeight * 4)
  const differingOverlapPixels = pixelmatch(a.subarray(0, width * overlapHeight * 4), b.subarray(0, width * overlapHeight * 4), overlapDiff, width, overlapHeight, options)
  fs.mkdirSync(path.dirname(outputPrefix), { recursive: true })
  await sharp(diff, { raw: { width, height, channels: 4 } }).png().toFile(`${outputPrefix}-diff.png`)
  const rgb = await sharp(b, { raw: { width, height, channels: 4 } }).removeAlpha().raw().toBuffer()
  const overlay = await sharp(rgb, { raw: { width, height, channels: 3 } }).ensureAlpha(0.5).png().toBuffer()
  await sharp(a, { raw: { width, height, channels: 4 } }).composite([{ input: overlay }]).png().toFile(`${outputPrefix}-overlay.png`)
  const label = Buffer.from(`<svg width="${width * 2}" height="44"><rect width="100%" height="100%" fill="#321007"/><text x="16" y="29" font-family="sans-serif" font-size="20" fill="white">Figma reference (left)</text><text x="${width + 16}" y="29" font-family="sans-serif" font-size="20" fill="white">Website (right)</text></svg>`)
  await sharp({ create: { width: width * 2, height: height + 44, channels: 4, background } }).composite([
    { input: label, top: 0, left: 0 },
    { input: await sharp(a, { raw: { width, height, channels: 4 } }).png().toBuffer(), top: 44, left: 0 },
    { input: await sharp(b, { raw: { width, height, channels: 4 } }).png().toBuffer(), top: 44, left: width },
  ]).png().toFile(`${outputPrefix}-side-by-side.png`)
  const result = {
    reference: path.relative(path.resolve(__dirname, '..'), reference).replaceAll('\\', '/'),
    actual: path.relative(path.resolve(__dirname, '..'), actual).replaceAll('\\', '/'),
    referenceSize: { width, height: left.info.height }, actualSize: { width, height: right.info.height },
    method: 'No resize, 100% source pixels, top aligned; shorter image padded cream at bottom. Antialiasing ignored, threshold0.1.',
    options, differingPixels, comparedCanvasPixels: width * height, differingOverlapPixels, overlapPixels: width * overlapHeight,
    interpretation: 'Diagnostic pixel counts only. This is not a design compliance score or an issue count. Inspect geometry, content, font rendering and intentional user overrides before classifying a defect.',
  }
  fs.writeFileSync(`${outputPrefix}.json`, JSON.stringify(result, null, 2))
  console.log(JSON.stringify(result))
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
