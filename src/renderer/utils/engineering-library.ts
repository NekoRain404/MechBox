export const ENGINEERING_LIBRARY_EVENT = 'mechbox:engineering-library-updated'

export interface EngineeringLibrarySnapshot {
  partMasters: WorkflowPartMasterRecord[]
  supplierParts: WorkflowSupplierPartRecord[]
  bomRevisionLinks: WorkflowBomRevisionLinkRecord[]
  documentAttachments: WorkflowDocumentAttachmentRecord[]
}

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

function emitEngineeringLibraryUpdated() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(ENGINEERING_LIBRARY_EVENT))
}

export function notifyEngineeringLibraryUpdated() {
  emitEngineeringLibraryUpdated()
}

export async function listPartMasters(limit = 200, projectId?: string | null) {
  if (!hasWorkflowBridge()) return []
  try {
    return await window.electron.workflow.listPartMasters(limit, projectId ?? null)
  } catch (error) {
    console.warn('读取零件主数据失败:', error)
    return []
  }
}

export async function upsertPartMaster(record: WorkflowPartMasterRecord) {
  if (!hasWorkflowBridge()) return record
  try {
    const saved = await window.electron.workflow.upsertPartMaster(record)
    emitEngineeringLibraryUpdated()
    return saved ?? record
  } catch (error) {
    console.warn('保存零件主数据失败:', error)
    return record
  }
}

export async function listSupplierParts(limit = 240, partId?: string | null) {
  if (!hasWorkflowBridge()) return []
  try {
    return await window.electron.workflow.listSupplierParts(limit, partId ?? null)
  } catch (error) {
    console.warn('读取供应商料号失败:', error)
    return []
  }
}

export async function upsertSupplierPart(record: WorkflowSupplierPartRecord) {
  if (!hasWorkflowBridge()) return record
  try {
    const saved = await window.electron.workflow.upsertSupplierPart(record)
    emitEngineeringLibraryUpdated()
    return saved ?? record
  } catch (error) {
    console.warn('保存供应商料号失败:', error)
    return record
  }
}

export async function listBomRevisionLinks(limit = 240, bomId?: string | null) {
  if (!hasWorkflowBridge()) return []
  try {
    return await window.electron.workflow.listBomRevisionLinks(limit, bomId ?? null)
  } catch (error) {
    console.warn('读取 BOM 修订链失败:', error)
    return []
  }
}

export async function listDocumentAttachments(
  limit = 240,
  objectType?: WorkflowChangeObjectType | null,
  objectId?: string | null,
  projectId?: string | null,
) {
  if (!hasWorkflowBridge()) return []
  try {
    return await window.electron.workflow.listDocumentAttachments(limit, objectType ?? null, objectId ?? null, projectId ?? null)
  } catch (error) {
    console.warn('读取文档附件失败:', error)
    return []
  }
}

export async function upsertDocumentAttachment(record: WorkflowDocumentAttachmentRecord) {
  if (!hasWorkflowBridge()) return record
  try {
    const saved = await window.electron.workflow.upsertDocumentAttachment(record)
    emitEngineeringLibraryUpdated()
    return saved ?? record
  } catch (error) {
    console.warn('保存文档附件失败:', error)
    return record
  }
}

export async function fetchEngineeringLibrarySnapshot(options?: {
  projectId?: string | null
  bomId?: string | null
  objectType?: WorkflowChangeObjectType | null
  objectId?: string | null
  limit?: number
}) {
  const limit = options?.limit ?? 240
  const [partMasters, supplierParts, bomRevisionLinks, documentAttachments] = await Promise.all([
    listPartMasters(limit, options?.projectId ?? null),
    listSupplierParts(limit),
    listBomRevisionLinks(limit, options?.bomId ?? null),
    listDocumentAttachments(limit, options?.objectType ?? null, options?.objectId ?? null, options?.projectId ?? null),
  ])

  return {
    partMasters,
    supplierParts,
    bomRevisionLinks,
    documentAttachments,
  } satisfies EngineeringLibrarySnapshot
}
