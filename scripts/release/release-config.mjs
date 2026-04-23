import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export const ROOT_DIR = resolve(import.meta.dirname, '../..')
export const RELEASE_DIR = join(ROOT_DIR, 'release')
export const PACKAGE_JSON_PATH = join(ROOT_DIR, 'package.json')
export const APP_META_PATH = join(ROOT_DIR, 'src/shared/app-meta.ts')

export const RELEASE_PROFILES = {
  'preview-full': {
    name: 'preview-full',
    title: '全量预览构建',
    targets: ['linux', 'windows'],
    description: '生成 Windows 与 Linux 预览产物，适合完整候选发布包。',
  },
  'linux-preview': {
    name: 'linux-preview',
    title: 'Linux 预览构建',
    targets: ['linux'],
    description: '仅生成 Linux 预览产物，适合当前 0.1 发布冲刺与 Linux 验收。',
  },
}

export function readPackageJson() {
  return JSON.parse(readFileSync(PACKAGE_JSON_PATH, 'utf8'))
}

export function readAppMetaSource() {
  return readFileSync(APP_META_PATH, 'utf8')
}

export function readAppMetaConst(source, name) {
  const match = source.match(new RegExp(`export const ${name} = '([^']+)'`))
  return match?.[1] ?? null
}

export function getReleaseMetadata() {
  const pkg = readPackageJson()
  const appMetaSource = readAppMetaSource()

  return {
    pkg,
    productName: pkg.build?.productName ?? pkg.name,
    packageName: pkg.name,
    version: pkg.version,
    appName: readAppMetaConst(appMetaSource, 'APP_NAME') ?? (pkg.build?.productName ?? pkg.name),
    releaseLabel: readAppMetaConst(appMetaSource, 'APP_RELEASE_LABEL') ?? pkg.version,
    releaseDate: readAppMetaConst(appMetaSource, 'APP_RELEASE_DATE'),
    license: readAppMetaConst(appMetaSource, 'APP_LICENSE_SPDX') ?? pkg.license ?? null,
    licenseName: readAppMetaConst(appMetaSource, 'APP_LICENSE_NAME'),
    rulesetVersion: readAppMetaConst(appMetaSource, 'RULESET_VERSION'),
  }
}

export function parseReleaseProfile(argv = process.argv.slice(2)) {
  const profileArg = argv.find((arg) => arg.startsWith('--profile='))
  const profileName = profileArg?.slice('--profile='.length) || 'preview-full'

  if (!RELEASE_PROFILES[profileName]) {
    const names = Object.keys(RELEASE_PROFILES).join(', ')
    throw new Error(`未知发布配置: ${profileName}，可用值: ${names}`)
  }

  return RELEASE_PROFILES[profileName]
}

export function buildRequiredArtifacts(metadata, profileName) {
  const { productName, packageName, version } = metadata

  if (!RELEASE_PROFILES[profileName]) {
    throw new Error(`未知发布配置: ${profileName}`)
  }

  const linuxArtifacts = [
    `${productName}-${version}.AppImage`,
    `${packageName}_${version}_amd64.deb`,
    'latest-linux.yml',
    'SHA256SUMS.txt',
  ]

  if (profileName === 'linux-preview') {
    return linuxArtifacts
  }

  return [
    `${productName} Setup ${version}.exe`,
    `${productName} ${version}.exe`,
    ...linuxArtifacts,
    'latest.yml',
  ]
}
