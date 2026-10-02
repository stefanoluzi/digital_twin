import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
const images = ['app', 'postgres', 'gateway'].map(image => {
  const raw = readFileSync(`tmp/security/trivy-${image}.json`)
  const report = JSON.parse(raw)
  const findings = (report.Results || []).flatMap(r => (r.Vulnerabilities || []).map(v => ({
    target: r.Target, id: v.VulnerabilityID, package: v.PkgName, version: v.InstalledVersion,
    fixed: v.FixedVersion || null, severity: v.Severity, status: v.Status, url: v.PrimaryURL,
  })))
  return {
    image, createdAt: report.CreatedAt, metadata: report.Metadata,
    reportSha256: createHash('sha256').update(raw).digest('hex'),
    counts: Object.fromEntries(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'UNKNOWN'].map(s => [s, findings.filter(v => v.severity === s).length])),
    uniqueVulnerabilityIds: new Set(findings.map(v => v.id)).size,
    highAndCritical: findings.filter(v => ['CRITICAL', 'HIGH'].includes(v.severity)),
  }
})
mkdirSync('docs/security/evidence', { recursive: true })
writeFileSync('docs/security/evidence/image-scan-summary.json', JSON.stringify({
  generatedAt: new Date().toISOString(),
  scanner: 'aquasec/trivy@sha256:62b1e65e8869bc4b4c6aa4fa2b21595256c7c2f6018a9d9ad61caf87187c1969',
  note: 'Package/advisory occurrences, not proven remotely exploitable issues. Not an exploitability assessment. Full reports in ignored tmp/security.',
  images,
}, null, 2))
console.log(images.map(({ image, counts }) => ({ image, counts })))
