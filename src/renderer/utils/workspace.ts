import { DEFAULT_PROJECT_VERSION } from '../../shared/app-meta'

export interface WorkspaceProject {
  id: string
  name: string
  module: string
  createdAt: string
  updatedAt: string
  version: string
  revisionCode: string
  inputSummary: string
  status: 'active' | 'archived'
  lifecycleStatus: 'draft' | 'in-review' | 'approved' | 'released' | 'archived'
}

export const PROJECTS_STORAGE_KEY = 'mechbox-projects'
export const ACTIVE_PROJECT_STORAGE_KEY = 'mechbox-active-project'
export const WORKSPACE_STORAGE_EVENT = 'mechbox:workspace-updated'

interface WorkspaceStorageEventDetail {
  scope: 'projects' | 'active-project'
  projectId?: string | null
}

let workspaceHydrationPromise: Promise<void> | null = null
let workspaceHydrationScheduled = false
const WORKSPACE_HYDRATION_DELAY_MS = 2500

function emitWorkspaceChange(detail: WorkspaceStorageEventDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<WorkspaceStorageEventDetail>(WORKSPACE_STORAGE_EVENT, { detail }))
}

function hasWorkflowBridge() {
  return typeof window !== 'undefined' && Boolean(window.electron?.workflow)
}

function normalizeProject(input: unknown, index: number): WorkspaceProject | null {
  if (!input || typeof input !== 'object') return null
  const item = input as Record<string, unknown>

  return {
    id: String(item.id ?? `proj_legacy_${index}`),
    name: String(item.name ?? '未命名项目'),
    module: String(item.module ?? 'seals'),
    createdAt: String(item.createdAt ?? new Date().toISOString()),
    updatedAt: String(item.updatedAt ?? new Date().toISOString()),
    version: String(item.version ?? DEFAULT_PROJECT_VERSION),
    revisionCode: String(item.revisionCode ?? 'A'),
    inputSummary: String(item.inputSummary ?? ''),
    status: item.status === 'archived' ? 'archived' : 'active',
    lifecycleStatus:
      item.lifecycleStatus === 'in-review' ||
      item.lifecycleStatus === 'approved' ||
      item.lifecycleStatus === 'released' ||
      item.lifecycleStatus === 'archived'
        ? item.lifecycleStatus
        : 'draft',
  }
}

function readProjectsFromStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => normalizeProject(item, index))
      .filter((item): item is WorkspaceProject => Boolean(item))
  } catch {
    return []
  }
}

function writeProjectsToStorage(projects: WorkspaceProject[]) {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects))
}

function readActiveProjectFromStorage() {
  try {
    const parsed = JSON.parse(localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY) ?? 'null')
    return normalizeProject(parsed, 0)
  } catch {
    return null
  }
}

function writeActiveProjectToStorage(project: WorkspaceProject | null) {
  if (!project) {
    localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY)
    return
  }
  localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, JSON.stringify(project))
}

async function replaceProjectsInDb(projects: WorkspaceProject[]) {
  if (!hasWorkflowBridge()) return
  try {
    await window.electron.workflow.replaceProjects(projects)
  } catch (error) {
    console.warn('同步项目到 SQLite 失败:', error)
  }
}

async function syncActiveProjectIdToDb(projectId: string | null) {
  if (!hasWorkflowBridge()) return
  try {
    await window.electron.workflow.setActiveProjectId(projectId)
  } catch (error) {
    console.warn('同步活动项目到 SQLite 失败:', error)
  }
}

function hydrateWorkspaceFromDb() {
  if (!hasWorkflowBridge()) return
  if (workspaceHydrationPromise) return

  workspaceHydrationPromise = (async () => {
    const [dbProjects, activeProjectId] = await Promise.all([
      window.electron.workflow.listProjects(),
      window.electron.workflow.getActiveProjectId(),
    ])

    const localProjects = readProjectsFromStorage()
    const localActiveProject = readActiveProjectFromStorage()

    if (!dbProjects.length && localProjects.length) {
      await window.electron.workflow.replaceProjects(localProjects)
      await window.electron.workflow.setActiveProjectId(localActiveProject?.id ?? null)
      return
    }

    if (!dbProjects.length) return

    const normalizedProjects = dbProjects
      .map((item, index) => normalizeProject(item, index))
      .filter((item): item is WorkspaceProject => Boolean(item))

    const nextActiveProject =
      normalizedProjects.find((project) => project.id === activeProjectId) ?? null

    writeProjectsToStorage(normalizedProjects)
    writeActiveProjectToStorage(nextActiveProject)
    emitWorkspaceChange({ scope: 'projects', projectId: nextActiveProject?.id ?? null })
    emitWorkspaceChange({ scope: 'active-project', projectId: nextActiveProject?.id ?? null })
  })().catch((error) => {
    console.warn('从 SQLite 水合项目数据失败:', error)
  })
}

function scheduleWorkspaceHydration() {
  if (!hasWorkflowBridge()) return
  if (workspaceHydrationPromise || workspaceHydrationScheduled) return

  workspaceHydrationScheduled = true
  window.setTimeout(() => {
    workspaceHydrationScheduled = false
    hydrateWorkspaceFromDb()
  }, WORKSPACE_HYDRATION_DELAY_MS)
}

export function createWorkspaceProject(params: {
  name: string
  module: string
  inputSummary?: string
}): WorkspaceProject {
  const now = new Date().toISOString()
  return {
    id: `proj_${Date.now()}`,
    name: params.name.trim(),
    module: params.module,
    createdAt: now,
    updatedAt: now,
    version: DEFAULT_PROJECT_VERSION,
    revisionCode: 'A',
    inputSummary: params.inputSummary ?? '',
    status: 'active',
    lifecycleStatus: 'draft',
  }
}

export async function fetchWorkspaceSnapshot() {
  hydrateWorkspaceFromDb()

  if (!hasWorkflowBridge()) {
    return {
      projects: readProjectsFromStorage(),
      activeProject: readActiveProjectFromStorage(),
    }
  }

  try {
    const [dbProjects, activeProjectId] = await Promise.all([
      window.electron.workflow.listProjects(),
      window.electron.workflow.getActiveProjectId(),
    ])

    const normalizedProjects = dbProjects
      .map((item, index) => normalizeProject(item, index))
      .filter((item): item is WorkspaceProject => Boolean(item))

    const activeProject = normalizedProjects.find((project) => project.id === activeProjectId) ?? null
    writeProjectsToStorage(normalizedProjects)
    writeActiveProjectToStorage(activeProject)
    return { projects: normalizedProjects, activeProject }
  } catch (error) {
    console.warn('显式读取项目工作流快照失败:', error)
    return {
      projects: readProjectsFromStorage(),
      activeProject: readActiveProjectFromStorage(),
    }
  }
}

export function loadStoredProjects() {
  scheduleWorkspaceHydration()
  return readProjectsFromStorage()
}

export function saveStoredProjects(projects: WorkspaceProject[]) {
  writeProjectsToStorage(projects)
  emitWorkspaceChange({ scope: 'projects' })
  const persistTask = workspaceHydrationPromise
    ? workspaceHydrationPromise.finally(() => replaceProjectsInDb(projects))
    : replaceProjectsInDb(projects)
  void persistTask
}

export function loadActiveProject() {
  scheduleWorkspaceHydration()
  return readActiveProjectFromStorage()
}

export function saveActiveProject(project: WorkspaceProject | null) {
  if (!project) {
    writeActiveProjectToStorage(null)
    emitWorkspaceChange({ scope: 'active-project', projectId: null })
    void syncActiveProjectIdToDb(null)
    return
  }
  writeActiveProjectToStorage(project)
  emitWorkspaceChange({ scope: 'active-project', projectId: project.id })
  void syncActiveProjectIdToDb(project.id)
}

export function upsertStoredProject(project: WorkspaceProject) {
  const projects = loadStoredProjects()
  const nextProjects = [project, ...projects.filter((item) => item.id !== project.id)]
  saveStoredProjects(nextProjects)
  return nextProjects
}

export function updateStoredProject(projectId: string, updater: (project: WorkspaceProject) => WorkspaceProject) {
  const projects = loadStoredProjects()
  const target = projects.find((project) => project.id === projectId)
  if (!target) return { projects, activeProject: loadActiveProject() }

  const updatedProject = updater(target)
  const nextProjects = projects.map((project) => (project.id === projectId ? updatedProject : project))
  saveStoredProjects(nextProjects)

  const activeProject = loadActiveProject()
  if (activeProject?.id === projectId) {
    saveActiveProject(updatedProject)
    return { projects: nextProjects, activeProject: updatedProject }
  }

  return { projects: nextProjects, activeProject }
}

export function removeStoredProject(projectId: string) {
  const nextProjects = loadStoredProjects().filter((project) => project.id !== projectId)
  saveStoredProjects(nextProjects)

  const activeProject = loadActiveProject()
  if (activeProject?.id === projectId) {
    saveActiveProject(null)
    return { projects: nextProjects, activeProject: null }
  }

  return { projects: nextProjects, activeProject }
}
