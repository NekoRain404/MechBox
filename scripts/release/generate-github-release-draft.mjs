import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { basename, join } from 'node:path'
import { RELEASE_DIR, getReleaseMetadata } from './release-config.mjs'

const metadata = getReleaseMetadata()
const manifestPath = join(RELEASE_DIR, 'release-manifest.json')
const releaseNotesPath = join(RELEASE_DIR, 'RELEASE_NOTES.md')
const outputPath = join(RELEASE_DIR, 'GITHUB_RELEASE.md')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const releaseNotes = readFileSync(releaseNotesPath, 'utf8').trim()
const tagName = `v${metadata.version}`
const headSha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()

if (manifest.version !== metadata.version) {
  throw new Error(`发布清单版本与当前版本不一致: ${manifest.version} !== ${metadata.version}`)
}

const requiredAssets = manifest.requiredArtifacts
  .map((filename) => `release/${filename}`)
  .filter((relativePath) => !relativePath.endsWith('/SHA256SUMS.txt'))

const uploadAssets = [
  ...requiredAssets,
  'release/SHA256SUMS.txt',
  'release/release-manifest.json',
  'release/RELEASE_NOTES.md',
]

const ghCommand = [
  `gh release create ${tagName}`,
  ...uploadAssets.map((path) => `  ${JSON.stringify(path)}`),
  '  --prerelease',
  `  --title ${JSON.stringify(`${metadata.appName} ${metadata.version}`)}`,
  '  --notes-file release/GITHUB_RELEASE.md',
].join(' \\\n')

const content = [
  `# GitHub Release 草稿: ${metadata.appName} ${metadata.version}`,
  '',
  `- Tag: \`${tagName}\``,
  `- Target: \`${headSha}\``,
  `- Release: ${metadata.releaseLabel}`,
  `- Date: ${metadata.releaseDate}`,
  `- License: ${metadata.license}`,
  `- Profile: ${manifest.releaseProfile}`,
  `- Targets: ${manifest.releaseTargets.join(', ')}`,
  '',
  '## Release Notes',
  '',
  releaseNotes,
  '',
  '## Upload Assets',
  '',
  ...uploadAssets.map((path) => `- \`${basename(path)}\``),
  '',
  '## gh CLI Command',
  '',
  '```bash',
  ghCommand,
  '```',
  '',
].join('\n')

writeFileSync(outputPath, `${content}\n`, 'utf8')
console.log(`已生成 GitHub Release 草稿: ${outputPath}`)
