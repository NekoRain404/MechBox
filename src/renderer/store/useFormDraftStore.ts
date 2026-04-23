/**
 * Form draft persistence via Pinia (Section 11.2)
 * 切换侧边栏菜单时，用户在计算页面填了一半的数据不会丢失
 */

import { defineStore } from 'pinia'

export interface FormDraft {
  moduleId: string
  data: Record<string, any>
  savedAt: number
}

export const FORM_DRAFTS_STORAGE_KEY = 'mechbox-form-drafts'

export function loadPersistedFormDrafts(): Record<string, FormDraft> {
  try {
    const saved = localStorage.getItem(FORM_DRAFTS_STORAGE_KEY)
    if (!saved) return {}
    const parsed = JSON.parse(saved) as Record<string, FormDraft>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (_error) {
    return {}
  }
}

export function savePersistedFormDrafts(drafts: Record<string, FormDraft>) {
  localStorage.setItem(FORM_DRAFTS_STORAGE_KEY, JSON.stringify(drafts))
}

export const useFormDraftStore = defineStore('formDraft', {
  state: () => ({
    drafts: {} as Record<string, FormDraft>
  }),

  actions: {
    saveDraft(moduleId: string, data: Record<string, any>) {
      this.drafts[moduleId] = {
        moduleId,
        data: JSON.parse(JSON.stringify(data)),
        savedAt: Date.now()
      }
      // 持久化到 localStorage
      try {
        savePersistedFormDrafts(this.drafts)
      } catch (e) { /* ignore */ }
    },

    loadDraft(moduleId: string): Record<string, any> | null {
      const draft = this.drafts[moduleId]
      if (!draft) return null
      return draft.data
    },

    clearDraft(moduleId: string) {
      delete this.drafts[moduleId]
      try {
        savePersistedFormDrafts(this.drafts)
      } catch (e) { /* ignore */ }
    },

    loadFromStorage() {
      try {
        this.drafts = loadPersistedFormDrafts()
        // 清除 7 天前的草稿
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
        for (const key of Object.keys(this.drafts)) {
          if (this.drafts[key].savedAt < cutoff) {
            delete this.drafts[key]
          }
        }
      } catch (e) { /* ignore */ }
    }
  }
})
