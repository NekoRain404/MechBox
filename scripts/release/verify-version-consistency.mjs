import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  RELEASE_DIR,
  ROOT_DIR,
  buildRequiredArtifacts,
  getReleaseMetadata,
  readAppMetaConst,
  readAppMetaSource,
} from './release-config.mjs'

const fail = (message) => {
  console.error(`版本一致性校验失败: ${message}`)
  process.exit(1)
}

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))

const metadata = getReleaseMetadata()
const { packageName, pkg, productName, releaseDate, releaseLabel, version } = metadata
const appMetaSource = readAppMetaSource()
const lock = readJson(join(ROOT_DIR, 'package-lock.json'))
const rootLock = lock.packages?.['']
const readme = readFileSync(join(ROOT_DIR, 'README.md'), 'utf8')

if (!rootLock) {
  fail('package-lock.json 缺少根 package 元数据')
}

if (rootLock.name !== pkg.name) {
  fail(`package-lock name 不一致: ${rootLock.name} !== ${pkg.name}`)
}

if (rootLock.version !== pkg.version) {
  fail(`package-lock version 不一致: ${rootLock.version} !== ${pkg.version}`)
}

if (rootLock.license !== pkg.license) {
  fail(`package-lock license 不一致: ${rootLock.license} !== ${pkg.license}`)
}

const expectedAppMeta = {
  APP_NAME: productName,
  APP_VERSION: version,
  APP_RELEASE_LABEL: releaseLabel,
  APP_RELEASE_DATE: releaseDate,
  APP_LICENSE_SPDX: pkg.license,
}

for (const [name, expected] of Object.entries(expectedAppMeta)) {
  const actual = readAppMetaConst(appMetaSource, name)
  if (actual !== expected) {
    fail(`${name} 不一致: ${actual} !== ${expected}`)
  }
}

const dependencySections = ['dependencies', 'devDependencies']
for (const section of dependencySections) {
  const rootSection = pkg[section] ?? {}
  const lockSection = rootLock[section] ?? {}

  for (const [name, declaredVersion] of Object.entries(rootSection)) {
    if (declaredVersion !== lockSection[name]) {
      fail(`${section}.${name} 与 package-lock 根记录不一致: ${declaredVersion} !== ${lockSection[name]}`)
    }

    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(declaredVersion)) {
      fail(`${section}.${name} 必须使用精确版本，当前为 ${declaredVersion}`)
    }

    const lockedVersion = lock.packages?.[`node_modules/${name}`]?.version
    if (lockedVersion && lockedVersion !== declaredVersion) {
      fail(`${section}.${name} 与 node_modules 锁定版本不一致: ${declaredVersion} !== ${lockedVersion}`)
    }
  }
}

for (const name of Object.keys(pkg.dependencies ?? {})) {
  if (name.startsWith('@types/')) {
    fail(`类型包不应出现在生产 dependencies: ${name}`)
  }
}

if (pkg.dependencies?.xlsx || pkg.devDependencies?.xlsx) {
  fail('0.1 发布链不应重新引入 xlsx 依赖')
}

const linuxArtifacts = buildRequiredArtifacts(metadata, 'linux-preview')
const readmeRequirements = [
  version,
  pkg.license,
  'Linux 预览版',
  `${productName}-${version}.AppImage`,
  `${packageName}_${version}_amd64.deb`,
  'npm run release:acceptance:linux',
]

for (const expectedText of readmeRequirements) {
  if (!readme.includes(expectedText)) {
    fail(`README 缺少发布关键字: ${expectedText}`)
  }
}

const manifestPath = join(RELEASE_DIR, 'release-manifest.json')
if (existsSync(manifestPath)) {
  const manifest = readJson(manifestPath)
  if (manifest.version !== version) {
    fail(`release-manifest version 不一致: ${manifest.version} !== ${version}`)
  }
  if (manifest.license !== pkg.license) {
    fail(`release-manifest license 不一致: ${manifest.license} !== ${pkg.license}`)
  }
  if (manifest.releaseLabel !== releaseLabel) {
    fail(`release-manifest releaseLabel 不一致: ${manifest.releaseLabel} !== ${releaseLabel}`)
  }
  if (manifest.releaseDate !== releaseDate) {
    fail(`release-manifest releaseDate 不一致: ${manifest.releaseDate} !== ${releaseDate}`)
  }
  if (manifest.releaseProfile === 'linux-preview') {
    const actualArtifacts = manifest.requiredArtifacts ?? []
    if (actualArtifacts.join('|') !== linuxArtifacts.join('|')) {
      fail('release-manifest Linux 必需产物列表不一致')
    }
  }
}

console.log('版本一致性校验通过')
console.log(`- 应用: ${productName}`)
console.log(`- 版本: ${version}`)
console.log(`- 协议: ${pkg.license}`)
console.log(`- 生产依赖: ${Object.keys(pkg.dependencies ?? {}).length}`)
console.log(`- 开发依赖: ${Object.keys(pkg.devDependencies ?? {}).length}`)
