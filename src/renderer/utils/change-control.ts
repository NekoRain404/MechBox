export const CHANGE_CONTROL_EVENT = 'mechbox:change-control-updated'

export interface ChangeControlSnapshot {
  changes: WorkflowChangeCaseRecord[]
  approvals: WorkflowApprovalTaskRecord[]
  events: WorkflowObjectEventLogRecord[]
}

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

function emitChangeControlUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(CHANGE_CONTROL_EVENT))
}

function normalizeChangeCaseRecord(input: WorkflowChangeCaseRecord): WorkflowChangeCaseRecord {
  return {
    ...input,
    revisionCode: input.revisionCode ?? 'A',
  }
}

function normalizeApprovalTaskRecord(input: WorkflowApprovalTaskRecord): WorkflowApprovalTaskRecord {
  return {
    ...input,
    seqNo: input.seqNo ?? 1,
  }
}

export async function listChangeCases(limit = 100, projectId?: string | null) {
  if (!hasWorkflowBridge()) return []
  try {
    return (await window.electron.workflow.listChangeCases(limit, projectId ?? null)).map(normalizeChangeCaseRecord)
  } catch (error) {
    console.warn('读取变更单失败:', error)
    return []
  }
}

export async function upsertChangeCase(record: WorkflowChangeCaseRecord) {
  if (!hasWorkflowBridge()) return normalizeChangeCaseRecord(record)
  try {
    const saved = await window.electron.workflow.upsertChangeCase(normalizeChangeCaseRecord(record))
    emitChangeControlUpdated()
    return saved ? normalizeChangeCaseRecord(saved) : normalizeChangeCaseRecord(record)
  } catch (error) {
    console.warn('保存变更单失败:', error)
    return normalizeChangeCaseRecord(record)
  }
}

export async function listApprovalTasks(
  limit = 120,
  objectType?: WorkflowChangeObjectType | null,
  objectId?: string | null,
) {
  if (!hasWorkflowBridge()) return []
  try {
    return (await window.electron.workflow.listApprovalTasks(limit, objectType ?? null, objectId ?? null)).map(
      normalizeApprovalTaskRecord,
    )
  } catch (error) {
    console.warn('读取审批任务失败:', error)
    return []
  }
}

export async function upsertApprovalTask(record: WorkflowApprovalTaskRecord) {
  if (!hasWorkflowBridge()) return normalizeApprovalTaskRecord(record)
  try {
    const saved = await window.electron.workflow.upsertApprovalTask(normalizeApprovalTaskRecord(record))
    emitChangeControlUpdated()
    return saved ? normalizeApprovalTaskRecord(saved) : normalizeApprovalTaskRecord(record)
  } catch (error) {
    console.warn('保存审批任务失败:', error)
    return normalizeApprovalTaskRecord(record)
  }
}

export async function listObjectEventLogs(
  limit = 160,
  objectType?: WorkflowChangeObjectType | null,
  objectId?: string | null,
  projectId?: string | null,
) {
  if (!hasWorkflowBridge()) return []
  try {
    return await window.electron.workflow.listObjectEventLogs(limit, objectType ?? null, objectId ?? null, projectId ?? null)
  } catch (error) {
    console.warn('读取对象事件日志失败:', error)
    return []
  }
}

export async function appendObjectEventLog(record: WorkflowObjectEventLogRecord) {
  if (!hasWorkflowBridge()) return record
  try {
    const saved = await window.electron.workflow.appendObjectEventLog(record)
    emitChangeControlUpdated()
    return saved ?? record
  } catch (error) {
    console.warn('写入对象事件日志失败:', error)
    return record
  }
}

export async function fetchChangeControlSnapshot(options?: {
  changeLimit?: number
  approvalLimit?: number
  eventLimit?: number
  projectId?: string | null
}) {
  const [changes, approvals, events] = await Promise.all([
    listChangeCases(options?.changeLimit ?? 120, options?.projectId ?? null),
    listApprovalTasks(options?.approvalLimit ?? 160),
    listObjectEventLogs(options?.eventLimit ?? 240, null, null, options?.projectId ?? null),
  ])

  return {
    changes,
    approvals,
    events,
  } satisfies ChangeControlSnapshot
}

export function filterChangeCasesByObject(
  objectType: WorkflowChangeObjectType,
  objectId: string,
  snapshot: ChangeControlSnapshot,
) {
  return snapshot.changes.filter((item) => item.objectType === objectType && item.objectId === objectId)
}

export function filterApprovalTasksByObject(
  objectType: WorkflowChangeObjectType,
  objectId: string,
  snapshot: ChangeControlSnapshot,
) {
  return snapshot.approvals.filter((item) => item.objectType === objectType && item.objectId === objectId)
}

export function filterObjectEventsByObject(
  objectType: WorkflowChangeObjectType,
  objectId: string,
  snapshot: ChangeControlSnapshot,
) {
  return snapshot.events.filter((item) => item.objectType === objectType && item.objectId === objectId)
}
