import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import assert from 'node:assert/strict'
const roots = ['dist', 'dist-spares', 'dist-planner', 'dist-lco']
let count = 0
function walk(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) walk(path)
    else {
      count++
      assert.ok(!path.endsWith('.map'), `Production sourcemap: ${path}`)
      if (/\.(css|html)$/.test(path)) {
        const text = readFileSync(path, 'utf8')
        assert.ok(!/(?:url\(\s*['"]?|(?:src|href)=["'])(?:https?:)?\/\//i.test(text), `Remote stylesheet/HTML asset: ${path}`)
      }
    }
  }
}
for (const root of roots) { assert.ok(existsSync(`${root}/index.html`), `Build ${root} first`); walk(root) }
for (const root of ['dist', 'dist-planner']) for (const folder of ['cmaps', 'standard_fonts', 'wasm']) assert.ok(readdirSync(`${root}/pdfjs/${folder}`).length > 0)
console.log(`PASS: ${count} build files; no remote HTML/CSS assets, no .map files; local PDF auxiliary resources present. Static test only, not a network capture.`)
