const fs = require('node:fs')
const path = require('node:path')
const root = path.resolve(__dirname, '..')
const data = JSON.parse(fs.readFileSync(path.join(root, 'runtime.json'), 'utf8'))
const unique = values => [...new Set(values)]
const latest = new Map(data.observations.map(o => [`${o.state}|${o.viewport.width}x${o.viewport.height}`, o]))
const checks = new Map(data.checks.filter(c => c.id !== 'SCENARIO-EXECUTION').map(c => [`${c.id}|${c.state}`, c]))
const observations = [...latest.values()]
const axe = new Map()
for (const o of observations) for (const v of o.quality.axe.violations ?? []) {
  const key = v.id
  const entry = axe.get(key) ?? { id: key, impact: v.impact, help: v.help, helpUrl: v.helpUrl, states: [], nodes: [] }
  entry.states.push(`${o.state}|${o.viewport.width}x${o.viewport.height}`)
  for (const n of v.nodes) if (!entry.nodes.some(x => JSON.stringify(x) === JSON.stringify(n))) entry.nodes.push(n)
  axe.set(key, entry)
}
const allChecks = [...checks.values()]
const out = {
  generatedAt: new Date().toISOString(),
  deduplication: 'Latest observation per state+viewport; latest check per id+state. Initial file-write instrumentation errors are superseded by targeted retry, never classified as product bugs.',
  scope: data.scope, totalRawObservations: data.observations.length, uniqueObservations: observations.length,
  states: unique(observations.map(o => o.state)).sort(),
  viewports: data.scope.viewports.map(v => ({ ...v, observations: observations.filter(o => o.viewport.width === v.width).length })),
  checkResults: Object.fromEntries(['PASS','FAIL','BLOCKED'].map(result => [result, allChecks.filter(c => c.result === result).length])),
  checks: allChecks,
  overflowFailures: observations.filter(o => o.quality.overflow.result === 'FAIL').map(o => ({ state: o.state, viewport: o.viewport, overflow: o.quality.overflow })),
  brokenImages: observations.filter(o => o.quality.images.result === 'FAIL').map(o => ({ state: o.state, viewport: o.viewport, images: o.quality.images })),
  axeResults: Object.fromEntries(['PASS','FAIL','NOT TESTED'].map(result => [result, observations.filter(o => o.quality.axe.result === result).length])),
  axeViolations: [...axe.values()].map(v => ({ ...v, states: unique(v.states) })),
  smallTargetCandidates: observations.filter(o => o.quality.touchTargets24.result === 'REVIEW').map(o => ({ state: o.state, viewport: o.viewport, candidates: o.quality.touchTargets24.candidates.map(c => ({ tag: c.tag, label: c.label, bounds: c.bounds })) })),
  pageErrors: unique(observations.flatMap(o => o.quality.runtime.pageErrors)),
  console: unique(observations.flatMap(o => o.quality.runtime.console).map(JSON.stringify)).map(JSON.parse),
  requestFailures: unique(observations.flatMap(o => o.quality.runtime.requestFailures).map(JSON.stringify)).map(JSON.parse),
  httpErrors: unique(observations.flatMap(o => o.quality.runtime.httpErrors).map(JSON.stringify)).map(JSON.parse),
  unloadedFonts: unique(observations.flatMap(o => o.dom.fonts.loaded).filter(f => f.status !== 'loaded').map(JSON.stringify)).map(JSON.parse),
  layoutShiftMax: Math.max(...observations.map(o => o.dom.layoutShift ?? 0)),
  screenshots: observations.map(o => ({ state: o.state, screenSize: `${o.viewport.width}x${o.viewport.height}`, route: o.route, ...o.screenshots })),
}
fs.writeFileSync(path.join(root, 'runtime-summary.json'), JSON.stringify(out, null, 2))
console.log(JSON.stringify({ uniqueObservations: out.uniqueObservations, viewports: out.viewports, checkResults: out.checkResults, overflowFailures: out.overflowFailures.length, brokenImages: out.brokenImages.length, axeResults: out.axeResults, axeRules: out.axeViolations.map(v => ({ id: v.id, states: v.states.length, nodes: v.nodes.length })), pageErrors: out.pageErrors, console: out.console, requestFailures: out.requestFailures, httpErrors: out.httpErrors, layoutShiftMax: out.layoutShiftMax }, null, 2))
