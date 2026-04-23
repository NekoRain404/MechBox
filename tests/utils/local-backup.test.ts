import { describe, expect, it } from 'vitest'
import {
  LOCAL_BACKUP_SCHEMA,
  createLocalBackupFilename,
  parseLocalBackupPayload,
} from '../../src/renderer/utils/local-backup'

describe('local-backup utilities', () => {
  it('creates a stable backup filename', () => {
    const filename = createLocalBackupFilename(new Date(2026, 3, 23, 17, 45, 12))
    expect(filename).toBe('mechbox-local-backup-20260423-174512.json')
  })

  it('parses a valid backup payload with defaults', () => {
    const snapshot = parseLocalBackupPayload({
      schema: LOCAL_BACKUP_SCHEMA,
      createdAt: '2026-04-23T09:45:12.000Z',
      app: {
        name: 'MechBox',
        version: '0.1.0-preview.1',
        releaseLabel: '0.1 预览版',
        license: 'GPL-3.0-only',
      },
      local: {
        unit: 'inch',
        favorites: [{ id: 'fav_1', module: 'seals', name: 'O 形圈方案', data: { dashCode: '-214' }, createdAt: 1 }],
        reports: [{ id: 'rpt_1', title: '密封报告', module: 'seals', createdAt: '2026-04-23T09:00:00Z', type: 'pdf', status: 'generated' }],
      },
      workflow: {
        projects: [{ id: 'proj_1', name: '试制项目', module: 'seals', createdAt: '2026-04-23T09:00:00Z', updatedAt: '2026-04-23T09:00:00Z', version: '0.1.0-preview.1', revisionCode: 'A', inputSummary: '', status: 'active', lifecycleStatus: 'draft' }],
        activeProjectId: 'proj_1',
        reports: [],
        bomDrafts: [],
        calculationRuns: [],
        scenarioSnapshots: [],
        calculationResults: [],
        changeCases: [],
        approvalTasks: [],
        objectEventLogs: [],
        partMasters: [],
        supplierParts: [],
        documentAttachments: [],
      },
      dataVersion: [],
    })

    expect(snapshot.schema).toBe(LOCAL_BACKUP_SCHEMA)
    expect(snapshot.local.unit).toBe('inch')
    expect(snapshot.local.favorites).toHaveLength(1)
    expect(snapshot.local.settings.theme).toBeTruthy()
    expect(snapshot.workflow?.activeProjectId).toBe('proj_1')
  })

  it('rejects invalid backup payload schema', () => {
    expect(() =>
      parseLocalBackupPayload({
        schema: 'invalid-schema',
      }),
    ).toThrow('不是有效的 MechBox 本地备份文件')
  })
})
