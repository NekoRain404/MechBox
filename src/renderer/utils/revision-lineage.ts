export interface RevisionLineageNode {
  id: string
  title: string
  revisionCode?: string | null
  status?: string | null
  updatedAt: string
  parentId?: string | null
  referenceLock?: Record<string, unknown> | null
}

export interface RevisionConsistencyCheck {
  level: 'info' | 'warning'
  summary: string
  detail: string
}

export interface RevisionLineageResult {
  ancestry: RevisionLineageNode[]
  current: RevisionLineageNode | null
  children: RevisionLineageNode[]
  siblings: RevisionLineageNode[]
  descendants: RevisionLineageNode[]
  consistencyChecks: RevisionConsistencyCheck[]
}

function sortByUpdatedDesc<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function normalizeReferenceLock(input: Record<string, unknown> | null | undefined) {
  if (!input || typeof input !== 'object') return null
  return {
    sourceObjectId: typeof input.sourceObjectId === 'string' ? input.sourceObjectId : null,
    sourceRevisionCode: typeof input.sourceRevisionCode === 'string' ? input.sourceRevisionCode : null,
    sourceStatus: typeof input.sourceStatus === 'string' ? input.sourceStatus : null,
  }
}

function collectDescendants(
  currentId: string,
  childrenMap: Map<string, RevisionLineageNode[]>,
  visited = new Set<string>(),
): RevisionLineageNode[] {
  const directChildren = childrenMap.get(currentId) ?? []
  const result: RevisionLineageNode[] = []

  for (const child of sortByUpdatedDesc(directChildren)) {
    if (visited.has(child.id)) continue
    visited.add(child.id)
    result.push(child)
    result.push(...collectDescendants(child.id, childrenMap, visited))
  }

  return result
}

export function buildRevisionLineage(
  nodes: RevisionLineageNode[],
  currentId: string | null | undefined,
  options?: {
    freezeResolver?: (status?: string | null) => { isReadOnly: boolean; label: string }
    typeLabel?: string
  },
): RevisionLineageResult {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const childrenMap = new Map<string, RevisionLineageNode[]>()

  for (const node of nodes) {
    if (!node.parentId) continue
    const current = childrenMap.get(node.parentId) ?? []
    current.push(node)
    childrenMap.set(node.parentId, current)
  }

  const current = currentId ? byId.get(currentId) ?? null : null
  if (!current) {
    return {
      ancestry: [],
      current: null,
      children: [],
      siblings: [],
      descendants: [],
      consistencyChecks: [],
    }
  }

  const ancestry: RevisionLineageNode[] = []
  const visited = new Set<string>([current.id])
  let cursor: RevisionLineageNode | null = current
  while (cursor) {
    ancestry.push(cursor)
    const nextParent: RevisionLineageNode | null = cursor.parentId ? byId.get(cursor.parentId) ?? null : null
    if (!nextParent || visited.has(nextParent.id)) break
    visited.add(nextParent.id)
    cursor = nextParent
  }
  ancestry.reverse()

  const children = sortByUpdatedDesc(childrenMap.get(current.id) ?? [])
  const siblings = current.parentId
    ? sortByUpdatedDesc((childrenMap.get(current.parentId) ?? []).filter((item) => item.id !== current.id))
    : []
  const descendants = collectDescendants(current.id, childrenMap)

  const referenceLock = normalizeReferenceLock(current.referenceLock)
  const typeLabel = options?.typeLabel ?? '对象'
  const consistencyChecks: RevisionConsistencyCheck[] = []
  const parent = current.parentId ? byId.get(current.parentId) ?? null : null

  if (current.parentId && !parent) {
    consistencyChecks.push({
      level: 'warning',
      summary: '派生来源缺失',
      detail: `${typeLabel}当前记录声明派生自 ${current.parentId}，但当前数据集中找不到该来源对象。`,
    })
  }

  if (!current.parentId && referenceLock) {
    consistencyChecks.push({
      level: 'warning',
      summary: '冻结引用孤立',
      detail: `${typeLabel}当前记录带有冻结引用，但没有显式派生来源标识。`,
    })
  }

  if (parent && referenceLock) {
    if (referenceLock.sourceObjectId && referenceLock.sourceObjectId !== parent.id) {
      consistencyChecks.push({
        level: 'warning',
        summary: '冻结引用对象不一致',
        detail: `${typeLabel}当前派生链指向 ${parent.id}，但冻结引用锁定的是 ${referenceLock.sourceObjectId}。`,
      })
    }

    if (referenceLock.sourceRevisionCode && referenceLock.sourceRevisionCode !== (parent.revisionCode ?? 'A')) {
      consistencyChecks.push({
        level: 'warning',
        summary: '冻结修订不一致',
        detail: `${typeLabel}冻结引用记录为修订 ${referenceLock.sourceRevisionCode}，当前派生来源实际修订为 ${parent.revisionCode ?? 'A'}。`,
      })
    }

    const freezeState = options?.freezeResolver?.(parent.status)
    if (freezeState && !freezeState.isReadOnly) {
      consistencyChecks.push({
        level: 'warning',
        summary: '来源基线未冻结',
        detail: `${typeLabel}当前派生来源仍处于 ${freezeState.label}，按工程治理要求更适合从冻结基线派生新修订。`,
      })
    }
  }

  if (!consistencyChecks.length) {
    consistencyChecks.push({
      level: 'info',
      summary: '修订链一致',
      detail: `${typeLabel}当前修订链没有发现显式的冻结引用或派生来源冲突。`,
    })
  }

  if (children.length > 0) {
    consistencyChecks.push({
      level: 'info',
      summary: '存在下游修订',
      detail: `${typeLabel}当前记录已经派生出 ${children.length} 个直接下游修订。`,
    })
  }

  return {
    ancestry,
    current,
    children,
    siblings,
    descendants,
    consistencyChecks,
  }
}
