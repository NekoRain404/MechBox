import { buildRevisionLineage, type RevisionLineageNode } from './revision-lineage'

export interface RevisionGovernanceNode extends RevisionLineageNode {
  objectType: 'project' | 'report' | 'document'
  projectId?: string | null
  routePath?: string | null
}

export interface RevisionGovernanceAlert {
  level: 'info' | 'warning'
  category: 'stale' | 'consistency' | 'baseline'
  priority: 'high' | 'medium' | 'low'
  repairability: 'repairable' | 'review' | 'reference'
  objectType: RevisionGovernanceNode['objectType']
  nodeId: string
  title: string
  summary: string
  recommendation: string
  issueCount: number
  details: string[]
  routePath?: string | null
  suggestedNodeId?: string | null
  suggestedTitle?: string | null
  suggestedRevisionCode?: string | null
  suggestedRoutePath?: string | null
  suggestedAction?: 'inspect-current' | 'inspect-latest' | 'keep-baseline'
}

export interface RevisionGovernanceSnapshot {
  totalNodes: number
  frozenNodes: number
  currentNodes: number
  healthyNodes: number
  staleNodes: number
  inconsistentNodes: number
  rootChains: number
  repairableAlerts: number
  reviewAlerts: number
  referenceAlerts: number
  currentRate: number
  completionRate: number
  latestNodes: RevisionGovernanceNode[]
  objectStats: Record<RevisionGovernanceNode['objectType'], {
    total: number
    frozen: number
    current: number
    healthy: number
    stale: number
    inconsistent: number
  }>
  projectSummaries: RevisionGovernanceProjectSummary[]
  alerts: RevisionGovernanceAlert[]
}

export interface RevisionGovernanceProjectSummary {
  projectId: string | null
  totalNodes: number
  frozenNodes: number
  currentNodes: number
  healthyNodes: number
  staleNodes: number
  inconsistentNodes: number
  repairableAlerts: number
  reviewAlerts: number
  referenceAlerts: number
  currentRate: number
  completionRate: number
}

export function getRevisionGovernancePriorityMeta(priority: RevisionGovernanceAlert['priority']) {
  const map = {
    high: { label: '高优先级', color: 'red' },
    medium: { label: '中优先级', color: 'orange' },
    low: { label: '低优先级', color: 'blue' },
  } satisfies Record<RevisionGovernanceAlert['priority'], { label: string; color: string }>
  return map[priority]
}

export function getRevisionGovernanceRepairabilityMeta(repairability: RevisionGovernanceAlert['repairability']) {
  const map = {
    repairable: { label: '可直接修复', color: 'green' },
    review: { label: '需人工复核', color: 'gold' },
    reference: { label: '基线参考', color: 'default' },
  } satisfies Record<RevisionGovernanceAlert['repairability'], { label: string; color: string }>
  return map[repairability]
}

export function getRevisionGovernanceCategoryMeta(category: RevisionGovernanceAlert['category']) {
  const map = {
    stale: { label: '滞后修订', color: 'orange' },
    consistency: { label: '一致性', color: 'volcano' },
    baseline: { label: '冻结基线', color: 'blue' },
  } satisfies Record<RevisionGovernanceAlert['category'], { label: string; color: string }>
  return map[category]
}

function sortByUpdatedDesc<T extends { updatedAt: string }>(items: T[]) {
  return [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

function getAlertPriority(input: {
  freezeState: { isReadOnly: boolean }
  hasStale: boolean
  hasConsistency: boolean
}) {
  if (input.hasStale && input.freezeState.isReadOnly) return 'high' as const
  if (input.hasStale || input.hasConsistency) return 'medium' as const
  return 'low' as const
}

function getAlertCategory(input: {
  hasStale: boolean
  hasConsistency: boolean
}) {
  if (input.hasStale) return 'stale' as const
  if (input.hasConsistency) return 'consistency' as const
  return 'baseline' as const
}

function getAlertRepairability(action?: RevisionGovernanceAlert['suggestedAction']) {
  if (action === 'inspect-latest') return 'repairable' as const
  if (action === 'inspect-current') return 'review' as const
  return 'reference' as const
}

export function analyzeRevisionGovernance(
  nodes: RevisionGovernanceNode[],
  freezeResolver: (status?: string | null) => { isReadOnly: boolean; label: string },
): RevisionGovernanceSnapshot {
  const objectTypes: RevisionGovernanceNode['objectType'][] = ['project', 'report', 'document']
  const objectStats = {
    project: { total: 0, frozen: 0, current: 0, healthy: 0, stale: 0, inconsistent: 0 },
    report: { total: 0, frozen: 0, current: 0, healthy: 0, stale: 0, inconsistent: 0 },
    document: { total: 0, frozen: 0, current: 0, healthy: 0, stale: 0, inconsistent: 0 },
  } satisfies RevisionGovernanceSnapshot['objectStats']
  const alerts: RevisionGovernanceAlert[] = []
  const latestNodes: RevisionGovernanceNode[] = []
  const projectSummaryMap = new Map<string, Omit<RevisionGovernanceProjectSummary, 'currentRate' | 'completionRate'>>()
  let repairableAlerts = 0
  let reviewAlerts = 0
  let referenceAlerts = 0
  let currentNodes = 0
  let healthyNodes = 0

  function getProjectSummary(projectId?: string | null) {
    const key = projectId ?? '__global__'
    const existing = projectSummaryMap.get(key)
    if (existing) return existing
    const created: Omit<RevisionGovernanceProjectSummary, 'currentRate' | 'completionRate'> = {
      projectId: projectId ?? null,
      totalNodes: 0,
      frozenNodes: 0,
      currentNodes: 0,
      healthyNodes: 0,
      staleNodes: 0,
      inconsistentNodes: 0,
      repairableAlerts: 0,
      reviewAlerts: 0,
      referenceAlerts: 0,
    }
    projectSummaryMap.set(key, created)
    return created
  }

  for (const objectType of objectTypes) {
    const scopedNodes = nodes.filter((node) => node.objectType === objectType)
    const rootIds = new Set(scopedNodes.filter((node) => !node.parentId).map((node) => node.id))
    const lineageCache = new Map<string, ReturnType<typeof buildRevisionLineage>>()
    const rootIdMap = new Map<string, string>()
    const latestByChain = new Map<string, RevisionGovernanceNode>()

    for (const node of scopedNodes) {
      const lineage = buildRevisionLineage(scopedNodes, node.id, {
        freezeResolver,
        typeLabel: objectType === 'project' ? '项目' : objectType === 'report' ? '报告' : '文档',
      })
      lineageCache.set(node.id, lineage)
      const rootId = lineage.ancestry[0]?.id ?? node.id
      rootIdMap.set(node.id, rootId)
      const existing = latestByChain.get(rootId)
      if (!existing || node.updatedAt > existing.updatedAt) {
        latestByChain.set(rootId, node)
      }
    }

    for (const node of scopedNodes) {
      objectStats[objectType].total += 1
      const projectSummary = getProjectSummary(node.projectId)
      projectSummary.totalNodes += 1
      const freezeState = freezeResolver(node.status)
      if (freezeState.isReadOnly) {
        objectStats[objectType].frozen += 1
        projectSummary.frozenNodes += 1
      }

      const lineage = lineageCache.get(node.id) ?? buildRevisionLineage(scopedNodes, node.id, {
        freezeResolver,
        typeLabel: objectType === 'project' ? '项目' : objectType === 'report' ? '报告' : '文档',
      })
      const rootId = rootIdMap.get(node.id) ?? node.id
      const latestInChain = latestByChain.get(rootId) ?? null
      const warningChecks = lineage.consistencyChecks.filter((item) => item.level === 'warning')
      const hasStale = latestInChain != null && latestInChain.id !== node.id
      const hasConsistency = warningChecks.length > 0
      const isCurrent = !hasStale
      const isHealthy = !hasStale && !hasConsistency

      if (isCurrent) {
        currentNodes += 1
        objectStats[objectType].current += 1
        projectSummary.currentNodes += 1
      }
      if (isHealthy) {
        healthyNodes += 1
        objectStats[objectType].healthy += 1
        projectSummary.healthyNodes += 1
      }

      const issueSummaries: string[] = []
      const issueRecommendations: string[] = []
      let suggestedAction: RevisionGovernanceAlert['suggestedAction'] | undefined
      let suggestedNodeId: string | null | undefined
      let suggestedTitle: string | null | undefined
      let suggestedRevisionCode: string | null | undefined
      let suggestedRoutePath: string | null | undefined
      let primarySummary: string | null = null

      if (warningChecks.length > 0) {
        objectStats[objectType].inconsistent += 1
        projectSummary.inconsistentNodes += 1
        primarySummary = warningChecks[0].summary
        issueSummaries.push(...warningChecks.map((item) => item.summary))
        issueRecommendations.push(...warningChecks.map((item) => item.detail))
        suggestedNodeId = latestInChain?.id ?? node.id
        suggestedTitle = latestInChain?.title ?? node.title
        suggestedRevisionCode = latestInChain?.revisionCode ?? node.revisionCode ?? null
        suggestedRoutePath = latestInChain?.routePath ?? node.routePath ?? null
        suggestedAction = latestInChain && latestInChain.id !== node.id ? 'inspect-latest' : 'inspect-current'
      }

      if (latestInChain && latestInChain.id !== node.id) {
        objectStats[objectType].stale += 1
        projectSummary.staleNodes += 1
        if (!primarySummary) {
          primarySummary = `存在更新修订 ${latestInChain.revisionCode ?? 'A'}`
        }
        issueSummaries.push(`存在更新修订 ${latestInChain.revisionCode ?? 'A'}`)
        issueRecommendations.push(
          freezeState.isReadOnly
            ? '当前对象已成为滞后基线，建议从最新修订继续派生或切换引用。'
            : '当前对象不是同源链上的最新修订，建议先审查是否需要并入更新修订。',
        )
        suggestedNodeId = latestInChain.id
        suggestedTitle = latestInChain.title
        suggestedRevisionCode = latestInChain.revisionCode ?? null
        suggestedRoutePath = latestInChain.routePath ?? null
        suggestedAction = 'inspect-latest'
      } else if (!node.parentId && rootIds.has(node.id) && lineage.children.length > 0 && freezeState.isReadOnly) {
        primarySummary = '当前基线已派生下游修订'
        issueSummaries.push('当前基线已派生下游修订')
        issueRecommendations.push(`当前冻结基线已派生出 ${lineage.children.length} 个直接下游修订，可作为参考基线保留。`)
        suggestedNodeId = node.id
        suggestedTitle = node.title
        suggestedRevisionCode = node.revisionCode ?? null
        suggestedRoutePath = node.routePath ?? null
        suggestedAction = 'keep-baseline'
      }

      if (issueSummaries.length > 0) {
        const category = getAlertCategory({ hasStale, hasConsistency })
        const priority = getAlertPriority({ freezeState, hasStale, hasConsistency })
        const recommendation = [...new Set(issueRecommendations)].join('；')
        const alert: RevisionGovernanceAlert = {
          level: hasStale || hasConsistency ? 'warning' : 'info',
          category,
          priority,
          repairability: getAlertRepairability(suggestedAction),
          objectType,
          nodeId: node.id,
          title: node.title,
          summary:
            issueSummaries.length > 1 && primarySummary
              ? `${primarySummary}，另有 ${issueSummaries.length - 1} 项关联检查`
              : (primarySummary ?? issueSummaries[0]),
          recommendation,
          issueCount: issueSummaries.length,
          details: issueSummaries,
          routePath: node.routePath ?? null,
          suggestedNodeId: suggestedNodeId ?? null,
          suggestedTitle: suggestedTitle ?? null,
          suggestedRevisionCode: suggestedRevisionCode ?? null,
          suggestedRoutePath: suggestedRoutePath ?? null,
          suggestedAction,
        }
        alerts.push(alert)

        if (alert.repairability === 'repairable') {
          repairableAlerts += 1
          projectSummary.repairableAlerts += 1
        } else if (alert.repairability === 'review') {
          reviewAlerts += 1
          projectSummary.reviewAlerts += 1
        } else {
          referenceAlerts += 1
          projectSummary.referenceAlerts += 1
        }
      }
    }
    latestNodes.push(...sortByUpdatedDesc(Array.from(latestByChain.values())))
  }

  const currentRate = nodes.length > 0 ? currentNodes / nodes.length : 1
  const completionRate = nodes.length > 0 ? healthyNodes / nodes.length : 1
  const projectSummaries = Array.from(projectSummaryMap.values())
    .map((summary) => ({
      ...summary,
      currentRate: summary.totalNodes > 0 ? summary.currentNodes / summary.totalNodes : 1,
      completionRate: summary.totalNodes > 0 ? summary.healthyNodes / summary.totalNodes : 1,
    }))
    .sort((left, right) => {
      if (left.completionRate !== right.completionRate) return left.completionRate - right.completionRate
      if (right.repairableAlerts !== left.repairableAlerts) return right.repairableAlerts - left.repairableAlerts
      return right.totalNodes - left.totalNodes
    })

  return {
    totalNodes: nodes.length,
    frozenNodes: objectStats.project.frozen + objectStats.report.frozen + objectStats.document.frozen,
    currentNodes,
    healthyNodes,
    staleNodes: objectStats.project.stale + objectStats.report.stale + objectStats.document.stale,
    inconsistentNodes: objectStats.project.inconsistent + objectStats.report.inconsistent + objectStats.document.inconsistent,
    rootChains: nodes.filter((node) => !node.parentId).length,
    repairableAlerts,
    reviewAlerts,
    referenceAlerts,
    currentRate,
    completionRate,
    latestNodes: sortByUpdatedDesc(latestNodes).slice(0, 12),
    objectStats,
    projectSummaries,
    alerts: alerts
      .sort((left, right) => {
        if (left.level !== right.level) return left.level === 'warning' ? -1 : 1
        if (left.priority !== right.priority) {
          const order = { high: 0, medium: 1, low: 2 }
          return order[left.priority] - order[right.priority]
        }
        if (left.issueCount !== right.issueCount) return right.issueCount - left.issueCount
        return left.title.localeCompare(right.title)
      })
      .slice(0, 16),
  }
}
