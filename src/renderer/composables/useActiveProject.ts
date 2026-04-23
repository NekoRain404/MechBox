import { onBeforeUnmount, onMounted, ref } from 'vue'
import {
  loadActiveProject,
  saveActiveProject,
  updateStoredProject,
  WORKSPACE_STORAGE_EVENT,
  type WorkspaceProject,
} from '../utils/workspace'

export function useActiveProject() {
  const activeProject = ref<WorkspaceProject | null>(loadActiveProject())

  function syncActiveProject() {
    activeProject.value = loadActiveProject()
  }

  function saveSummaryToProject(summary: string) {
    if (!activeProject.value) return null

    const result = updateStoredProject(activeProject.value.id, (project) => ({
      ...project,
      inputSummary: summary,
      updatedAt: new Date().toISOString(),
    }))

    activeProject.value = result.activeProject
    if (activeProject.value) {
      saveActiveProject(activeProject.value)
    }
    return activeProject.value
  }

  onMounted(() => {
    window.addEventListener(WORKSPACE_STORAGE_EVENT, syncActiveProject)
  })

  onBeforeUnmount(() => {
    window.removeEventListener(WORKSPACE_STORAGE_EVENT, syncActiveProject)
  })

  return {
    activeProject,
    syncActiveProject,
    saveSummaryToProject,
  }
}
