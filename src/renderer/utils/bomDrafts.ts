import type { BOMItem } from '../engine/bom-export'

export interface BomDraftPayload {
  bomId?: string
  projectId?: string
  projectName: string
  projectNumber: string
  author?: string
  date?: string
  revision?: string
  summary?: string
  status?: 'draft' | 'in-review' | 'approved' | 'released' | 'archived'
  sourceKind?: 'manual' | 'derived' | 'imported'
  items: BOMItem[]
}

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

export async function loadLatestBomDraft(projectId?: string | null) {
  if (!hasWorkflowBridge()) return null
  try {
    return await window.electron.workflow.getLatestBomDraft(projectId ?? null)
  } catch (error) {
    console.warn('读取 BOM 草稿失败:', error)
    return null
  }
}

export async function listBomDrafts(limit = 100) {
  if (!hasWorkflowBridge()) return []
  try {
    return await window.electron.workflow.listBomDrafts(limit)
  } catch (error) {
    console.warn('读取 BOM 草稿列表失败:', error)
    return []
  }
}

export async function saveBomDraft(payload: BomDraftPayload) {
  if (!hasWorkflowBridge()) return null
  try {
    return await window.electron.workflow.saveBomDraft(payload)
  } catch (error) {
    console.warn('保存 BOM 草稿失败:', error)
    return null
  }
}
