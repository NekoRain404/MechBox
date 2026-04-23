export type WorkflowScenarioSnapshotKind = 'input' | 'context' | 'decision'

export type WorkflowCalculationResultKind =
  | 'primary'
  | 'summary'
  | 'distribution'
  | 'recommendation'
  | 'comparison'
  | 'analysis'

export type WorkflowCalculationResultStatus = 'computed' | 'warning' | 'error' | 'archived'

export interface WorkflowScenarioSnapshot {
  id: string
  runId: string
  module: string
  snapshotKind: WorkflowScenarioSnapshotKind
  title?: string
  summary?: string
  inputData?: unknown
  contextData?: unknown
  createdAt: string
}

export interface WorkflowCalculationResult {
  id: string
  runId: string
  module: string
  resultKind: WorkflowCalculationResultKind
  status: WorkflowCalculationResultStatus
  summary?: string
  outputData?: unknown
  derivedMetrics?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface WorkflowArtifactBundle {
  run: WorkflowCalculationRunRecord
  snapshots?: WorkflowScenarioSnapshot[]
  results?: WorkflowCalculationResult[]
}

export const WORKFLOW_ARTIFACTS_EVENT = 'mechbox:workflow-artifacts-updated'
const LATEST_ARTIFACT_LINKS_KEY = 'mechbox-latest-artifact-links'

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

function emitWorkflowArtifactsChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(WORKFLOW_ARTIFACTS_EVENT))
}

type LatestArtifactLink = {
  module: string
  projectId?: string
  runId: string
  resultId?: string
  updatedAt: string
}

function readLatestArtifactLinks() {
  if (typeof window === 'undefined') return {} as Record<string, LatestArtifactLink>
  try {
    return JSON.parse(localStorage.getItem(LATEST_ARTIFACT_LINKS_KEY) ?? '{}') as Record<string, LatestArtifactLink>
  } catch {
    return {}
  }
}

function writeLatestArtifactLinks(map: Record<string, LatestArtifactLink>) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LATEST_ARTIFACT_LINKS_KEY, JSON.stringify(map))
}

function buildArtifactLinkKey(module: string, projectId?: string | null) {
  return `${projectId || 'global'}::${module}`
}

export function rememberLatestWorkflowArtifactLink(input: {
  module: string
  projectId?: string | null
  runId: string
  resultId?: string | null
  updatedAt?: string
}) {
  const map = readLatestArtifactLinks()
  map[buildArtifactLinkKey(input.module, input.projectId)] = {
    module: input.module,
    projectId: input.projectId ?? undefined,
    runId: input.runId,
    resultId: input.resultId ?? undefined,
    updatedAt: input.updatedAt ?? new Date().toISOString(),
  }
  writeLatestArtifactLinks(map)
}

export function resolveLatestWorkflowArtifactLink(module: string, projectId?: string | null) {
  const map = readLatestArtifactLinks()
  return (
    map[buildArtifactLinkKey(module, projectId)] ??
    map[buildArtifactLinkKey(module, null)] ??
    null
  )
}

export async function importWorkflowArtifactBundles(bundles: WorkflowArtifactBundle[]) {
  const imported: Array<{ runId: string; resultId?: string | null }> = []
  for (const bundle of bundles) {
    const response = await recordWorkflowArtifacts(bundle)
    imported.push({
      runId: response.run?.id ?? bundle.run.id,
      resultId: response.results[0]?.id ?? bundle.results?.[0]?.id ?? null,
    })
  }
  emitWorkflowArtifactsChange()
  return imported
}

function normalizeSnapshot(input: unknown): WorkflowScenarioSnapshot | null {
  if (!input || typeof input !== 'object') return null
  const item = input as Record<string, unknown>
  const snapshotKind =
    item.snapshotKind === 'context' || item.snapshotKind === 'decision' ? item.snapshotKind : 'input'

  return {
    id: String(item.id ?? `snapshot_${Date.now()}`),
    runId: String(item.runId ?? ''),
    module: String(item.module ?? 'unknown'),
    snapshotKind,
    title: item.title ? String(item.title) : undefined,
    summary: item.summary ? String(item.summary) : undefined,
    inputData: item.inputData,
    contextData: item.contextData,
    createdAt: String(item.createdAt ?? new Date().toISOString()),
  }
}

function normalizeResult(input: unknown): WorkflowCalculationResult | null {
  if (!input || typeof input !== 'object') return null
  const item = input as Record<string, unknown>
  const resultKind =
    item.resultKind === 'summary' ||
    item.resultKind === 'distribution' ||
    item.resultKind === 'recommendation' ||
    item.resultKind === 'comparison' ||
    item.resultKind === 'analysis'
      ? item.resultKind
      : 'primary'
  const status =
    item.status === 'warning' || item.status === 'error' || item.status === 'archived'
      ? item.status
      : 'computed'

  return {
    id: String(item.id ?? `result_${Date.now()}`),
    runId: String(item.runId ?? ''),
    module: String(item.module ?? 'unknown'),
    resultKind,
    status,
    summary: item.summary ? String(item.summary) : undefined,
    outputData: item.outputData,
    derivedMetrics:
      item.derivedMetrics && typeof item.derivedMetrics === 'object'
        ? (item.derivedMetrics as Record<string, unknown>)
        : null,
    createdAt: String(item.createdAt ?? new Date().toISOString()),
    updatedAt: String(item.updatedAt ?? item.createdAt ?? new Date().toISOString()),
  }
}

export async function listWorkflowScenarioSnapshots(limit = 100, runId?: string | null) {
  if (!hasWorkflowBridge()) return []
  try {
    const rows = await window.electron.workflow.listScenarioSnapshots(limit, runId ?? null)
    return rows.map((row) => normalizeSnapshot(row)).filter((row): row is WorkflowScenarioSnapshot => Boolean(row))
  } catch (error) {
    console.warn('读取 ScenarioSnapshot 失败:', error)
    return []
  }
}

export async function listWorkflowCalculationResults(limit = 100, runId?: string | null) {
  if (!hasWorkflowBridge()) return []
  try {
    const rows = await window.electron.workflow.listCalculationResults(limit, runId ?? null)
    return rows.map((row) => normalizeResult(row)).filter((row): row is WorkflowCalculationResult => Boolean(row))
  } catch (error) {
    console.warn('读取 CalculationResult 失败:', error)
    return []
  }
}

export async function recordWorkflowArtifacts(bundle: WorkflowArtifactBundle) {
  if (!hasWorkflowBridge()) {
    return {
      run: bundle.run,
      snapshots: bundle.snapshots ?? [],
      results: bundle.results ?? [],
    }
  }

  try {
    const response = await window.electron.workflow.recordCalculationArtifacts(bundle)
    const primaryResult = response.results[0] ?? null
    rememberLatestWorkflowArtifactLink({
      module: bundle.run.module,
      projectId: bundle.run.projectId,
      runId: bundle.run.id,
      resultId: primaryResult?.id ?? null,
      updatedAt: primaryResult?.updatedAt ?? bundle.run.createdAt,
    })
    emitWorkflowArtifactsChange()
    return {
      run: response.run,
      snapshots: response.snapshots
        .map((row) => normalizeSnapshot(row))
        .filter((row): row is WorkflowScenarioSnapshot => Boolean(row)),
      results: response.results
        .map((row) => normalizeResult(row))
        .filter((row): row is WorkflowCalculationResult => Boolean(row)),
    }
  } catch (error) {
    console.warn('记录正式计算对象失败:', error)
    const primaryResult = bundle.results?.[0] ?? null
    rememberLatestWorkflowArtifactLink({
      module: bundle.run.module,
      projectId: bundle.run.projectId,
      runId: bundle.run.id,
      resultId: primaryResult?.id ?? null,
      updatedAt: primaryResult?.updatedAt ?? bundle.run.createdAt,
    })
    return {
      run: bundle.run,
      snapshots: bundle.snapshots ?? [],
      results: bundle.results ?? [],
    }
  }
}
