import type { CalculationRunRecord } from './calculation-runs'
import { listWorkflowCalculationRuns } from './calculation-runs'
import {
  listWorkflowCalculationResults,
  listWorkflowScenarioSnapshots,
  type WorkflowCalculationResult,
  type WorkflowScenarioSnapshot,
} from './workflow-artifacts'
import type { WorkspaceProject } from './workspace'

export interface WorkflowInsightsSnapshot {
  runs: CalculationRunRecord[]
  results: WorkflowCalculationResult[]
  snapshots: WorkflowScenarioSnapshot[]
}

export interface WorkflowProjectInsight {
  runCount: number
  resultCount: number
  snapshotCount: number
  warningCount: number
  errorCount: number
  formalReportCount: number
  lastResultAt?: string
}

function isRunLinkedToProject(run: CalculationRunRecord, project: WorkspaceProject) {
  return run.projectId === project.id || run.projectName === project.name || run.projectNumber === project.id
}

export async function fetchWorkflowInsights(options?: {
  runLimit?: number
  resultLimit?: number
  snapshotLimit?: number
}) {
  const [runs, results, snapshots] = await Promise.all([
    listWorkflowCalculationRuns(options?.runLimit ?? 120),
    listWorkflowCalculationResults(options?.resultLimit ?? 240),
    listWorkflowScenarioSnapshots(options?.snapshotLimit ?? 240),
  ])

  return {
    runs,
    results,
    snapshots,
  } satisfies WorkflowInsightsSnapshot
}

export function buildWorkflowProjectInsight(
  project: WorkspaceProject,
  data: WorkflowInsightsSnapshot,
  formalReportCount = 0,
): WorkflowProjectInsight {
  const projectRuns = data.runs.filter((run) => isRunLinkedToProject(run, project))
  const runIds = new Set(projectRuns.map((run) => run.id))
  const projectResults = data.results.filter((result) => runIds.has(result.runId))
  const projectSnapshots = data.snapshots.filter((snapshot) => runIds.has(snapshot.runId))
  const lastResult = [...projectResults].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]

  return {
    runCount: projectRuns.length,
    resultCount: projectResults.length,
    snapshotCount: projectSnapshots.length,
    warningCount: projectResults.filter((result) => result.status === 'warning').length,
    errorCount: projectResults.filter((result) => result.status === 'error').length,
    formalReportCount,
    lastResultAt: lastResult?.updatedAt,
  }
}

export function groupResultsByModule(results: WorkflowCalculationResult[]) {
  const groups = new Map<string, WorkflowCalculationResult[]>()
  for (const item of results) {
    const current = groups.get(item.module) ?? []
    current.push(item)
    groups.set(item.module, current)
  }
  return groups
}
