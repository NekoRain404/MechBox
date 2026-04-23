import { useStandardStore } from '../store/useStandardStore'
import { useActiveProject } from './useActiveProject'
import type { CalculationRunSourceKind } from '../utils/calculation-runs'
import {
  recordWorkflowArtifacts,
  type WorkflowCalculationResultKind,
  type WorkflowCalculationResultStatus,
} from '../utils/workflow-artifacts'

interface RecordModuleCalculationOptions {
  module: string
  name: string
  projectSummary: string
  inputData?: unknown
  contextData?: unknown
  outputData?: unknown
  recentData?: unknown
  decisionData?: unknown
  derivedMetrics?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
  sourceKind?: CalculationRunSourceKind
  linkedReportId?: string
  resultKind?: WorkflowCalculationResultKind
  resultStatus?: WorkflowCalculationResultStatus
  appendRecent?: boolean
}

export interface RecordedModuleCalculation {
  runId: string
  resultId?: string | null
  createdAt: string
}

export function useWorkflowRecorder() {
  const store = useStandardStore()
  const { activeProject, saveSummaryToProject } = useActiveProject()

  async function recordModuleCalculation(options: RecordModuleCalculationOptions): Promise<RecordedModuleCalculation> {
    const now = Date.now()
    const createdAt = new Date(now).toISOString()
    const runId = `run_recent_${options.module}_${now}`
    const recentId = runId.replace(/^run_recent_/, '')

    if (options.appendRecent !== false) {
      store.addRecentCalculation(
        options.module,
        options.name,
        options.recentData ?? options.outputData ?? options.inputData ?? null,
        {
          id: recentId,
          createdAt: now,
          persistToWorkflow: false,
        },
      )
    }

    if (activeProject.value) {
      saveSummaryToProject(options.projectSummary)
    }

    const snapshots = [
      options.inputData !== undefined
        ? {
            id: `snapshot_input_${runId}`,
            runId,
            module: options.module,
            snapshotKind: 'input' as const,
            title: `${options.name} 输入`,
            summary: options.projectSummary,
            inputData: options.inputData,
            createdAt,
          }
        : null,
      options.contextData !== undefined
        ? {
            id: `snapshot_context_${runId}`,
            runId,
            module: options.module,
            snapshotKind: 'context' as const,
            title: `${options.name} 上下文`,
            summary: options.projectSummary,
            contextData: options.contextData,
            createdAt,
          }
        : null,
      options.decisionData !== undefined
        ? {
            id: `snapshot_decision_${runId}`,
            runId,
            module: options.module,
            snapshotKind: 'decision' as const,
            title: `${options.name} 决策`,
            summary: options.projectSummary,
            contextData: options.decisionData,
            createdAt,
          }
        : null,
    ].filter((item): item is NonNullable<typeof item> => Boolean(item))

    const derivedMetrics =
      options.derivedMetrics == null && options.metadata && typeof options.metadata === 'object'
        ? options.metadata
        : options.derivedMetrics ?? null

    const response = await recordWorkflowArtifacts({
      run: {
        id: runId,
        module: options.module,
        name: options.name,
        createdAt,
        projectId: activeProject.value?.id,
        projectNumber: activeProject.value?.id,
        projectName: activeProject.value?.name,
        sourceKind: options.sourceKind ?? 'recent-calculation',
        summary: options.projectSummary,
        linkedReportId: options.linkedReportId,
        inputData: options.inputData,
        outputData: options.outputData,
        metadata: options.metadata ?? null,
      },
      snapshots,
      results: [
        {
          id: `result_primary_${runId}`,
          runId,
          module: options.module,
          resultKind: options.resultKind ?? 'primary',
          status: options.resultStatus ?? 'computed',
          summary: options.projectSummary,
          outputData: options.outputData,
          derivedMetrics,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    })

    return {
      runId: response.run?.id ?? runId,
      resultId: response.results[0]?.id ?? null,
      createdAt,
    }
  }

  return {
    activeProject,
    recordModuleCalculation,
  }
}
