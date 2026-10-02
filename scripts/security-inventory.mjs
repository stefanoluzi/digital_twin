import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const out = 'docs/security/evidence'
mkdirSync(out, { recursive: true })
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).trim().split(/\r?\n/)
const matches = []; const suspectFiles = new Set()
const secret = /(?:gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|postgres(?:ql)?:\/\/[^:\s]+:(?!CHANGE_ME|\$|\{)[^@\s]+@)/
for (const file of files) {
  if (!/\.(?:ts|tsx|js|mjs|css|html|json|yml|yaml|sql|md|example)$/.test(file) || file.includes('evidence/')) continue
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  lines.forEach((line, i) => {
    if (secret.test(line)) suspectFiles.add(file) // Never store matching credentials.
    if (file !== 'package-lock.json' && /https?:\/\/|fetch\(|WebSocket|XMLHttpRequest|sendBeacon|telemetry|analytics|dangerouslySetInnerHTML|\$\w+RawUnsafe/.test(line)) matches.push({ file, line: i + 1, categories: [...line.matchAll(/https?:\/\/[^\s'"`<>]+|fetch\(|WebSocket|XMLHttpRequest|sendBeacon|telemetry|analytics|dangerouslySetInnerHTML|\$\w+RawUnsafe/g)].map(m => m[0]).filter(x => !secret.test(x)) })
  })
}
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
const packages = Object.entries(lock.packages).filter(([p]) => p).map(([path, p]) => ({ path, version: p.version, integrity: p.integrity, installScript: !!p.hasInstallScript, dev: !!p.dev }))
const history = []
for (const rev of execFileSync('git', ['rev-list', '--all'], { encoding: 'utf8' }).trim().split(/\r?\n/)) {
  const result = spawnSync('git', ['grep', '-IlE', 'gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|postgres(ql)?://[^: ]+:[^@ ]+@', rev, '--', ':!package-lock.json'], { encoding: 'utf8', maxBuffer: 10e6 })
  if (result.status === 0) history.push(...result.stdout.trim().split(/\r?\n/))
}
writeFileSync(`${out}/inventory.json`, JSON.stringify({ generatedAt: new Date().toISOString(), gitHead: execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), trackedAndNewFiles: files.length, packages, matches, possibleSecretFiles: [...suspectFiles], historyCandidates: history }, null, 2))
// Use installed npm CLI adjacent to Node, not a shell-interpolated command.
const cli = process.platform === 'win32' ? new URL('./node_modules/npm/bin/npm-cli.js', `file:///${process.execPath.replaceAll('\\','/').replace(/[^/]+$/, '')}`).pathname.slice(1) : process.env.NPM_CLI_PATH
if (cli) for (const [name, args] of [['npm-audit.json', ['audit', '--json']], ['sbom.cdx.json', ['sbom', '--sbom-format', 'cyclonedx']]]) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', maxBuffer: 30e6 })
  if (r.stdout) { JSON.parse(r.stdout); writeFileSync(`${out}/${name}`, r.stdout) }
  else throw new Error(`${name} failed: ${r.error || r.status}`)
}
console.log(JSON.stringify({ files: files.length, packages: packages.length, possibleSecretFiles: [...suspectFiles], historyCandidateCount: history.length }))
