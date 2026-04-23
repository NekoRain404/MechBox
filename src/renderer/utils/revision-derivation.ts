export interface RevisionReferenceLock {
  mode: 'frozen-reference'
  sourceObjectType: string
  sourceObjectId: string
  sourceRevisionCode: string
  sourceStatus?: string | null
  lockedAt: string
}

function normalizeRevisionCode(value?: string | null) {
  const normalized = String(value ?? 'A').trim().toUpperCase()
  return normalized || 'A'
}

function incrementAlphabeticRevision(code: string) {
  const chars = code.split('')
  let carry = 1

  for (let index = chars.length - 1; index >= 0; index -= 1) {
    const current = chars[index]
    if (!/[A-Z]/.test(current)) return `${code}_2`
    if (!carry) break
    if (current === 'Z') {
      chars[index] = 'A'
      carry = 1
    } else {
      chars[index] = String.fromCharCode(current.charCodeAt(0) + 1)
      carry = 0
    }
  }

  return carry ? `A${chars.join('')}` : chars.join('')
}

export function getNextRevisionCode(current?: string | null) {
  const normalized = normalizeRevisionCode(current)
  if (/^\d+$/.test(normalized)) {
    return String(Number(normalized) + 1)
  }
  if (/^[A-Z]+$/.test(normalized)) {
    return incrementAlphabeticRevision(normalized)
  }
  return `${normalized}_2`
}

export function buildReferenceLock(input: {
  sourceObjectType: string
  sourceObjectId: string
  sourceRevisionCode?: string | null
  sourceStatus?: string | null
  lockedAt?: string
}) {
  return {
    mode: 'frozen-reference',
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    sourceRevisionCode: normalizeRevisionCode(input.sourceRevisionCode),
    sourceStatus: input.sourceStatus ?? null,
    lockedAt: input.lockedAt ?? new Date().toISOString(),
  } satisfies RevisionReferenceLock
}

function stripRevisionSuffix(title: string) {
  return title
    .replace(/\s*[·•-]?\s*修订\s*[A-Z0-9_]+\s*$/i, '')
    .replace(/\s*[（(]\s*修订\s*[A-Z0-9_]+\s*[)）]\s*$/i, '')
    .trim()
}

export function buildDerivedTitle(title: string, nextRevisionCode: string) {
  const baseTitle = stripRevisionSuffix(title)
  return `${baseTitle} · 修订 ${nextRevisionCode}`
}

export function buildDerivedFileName(fileName: string | undefined, nextRevisionCode: string) {
  if (!fileName) return undefined

  const lastDotIndex = fileName.lastIndexOf('.')
  const stem = lastDotIndex >= 0 ? fileName.slice(0, lastDotIndex) : fileName
  const ext = lastDotIndex >= 0 ? fileName.slice(lastDotIndex) : ''
  const normalizedStem = stripRevisionSuffix(stem)
  return `${normalizedStem}_rev_${nextRevisionCode}${ext}`
}

export function buildDerivationNote(input: {
  sourceTitle: string
  sourceRevisionCode?: string | null
  nextRevisionCode: string
}) {
  return `派生自 ${input.sourceTitle} 修订 ${normalizeRevisionCode(input.sourceRevisionCode)}，当前工作副本为修订 ${input.nextRevisionCode}。`
}
