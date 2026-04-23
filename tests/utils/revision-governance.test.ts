import { describe, expect, test } from 'vitest'
import { analyzeRevisionGovernance } from '../../src/renderer/utils/revision-governance'

function freezeResolver(status?: string | null) {
  const isReadOnly = status === 'released' || status === 'archived' || status === 'approved'
  return {
    isReadOnly,
    label: isReadOnly ? '冻结态' : '工作态',
  }
}

describe('revision governance', () => {
  test('聚合同一对象的滞后与一致性问题，并给出可直接修复状态', () => {
    const snapshot = analyzeRevisionGovernance(
      [
        {
          id: 'doc_A',
          title: '密封沟槽计算书 A',
          revisionCode: 'A',
          status: 'released',
          updatedAt: '2026-04-20T10:00:00.000Z',
          parentId: null,
          referenceLock: {
            sourceObjectId: 'ghost',
            sourceRevisionCode: 'A',
          },
          objectType: 'document',
          projectId: 'proj_1',
          routePath: '/documents',
        },
        {
          id: 'doc_B',
          title: '密封沟槽计算书 B',
          revisionCode: 'B',
          status: 'draft',
          updatedAt: '2026-04-22T10:00:00.000Z',
          parentId: 'doc_A',
          referenceLock: {
            sourceObjectId: 'doc_A',
            sourceRevisionCode: 'A',
            sourceStatus: 'released',
          },
          objectType: 'document',
          projectId: 'proj_1',
          routePath: '/documents',
        },
      ],
      freezeResolver,
    )

    expect(snapshot.staleNodes).toBe(1)
    expect(snapshot.inconsistentNodes).toBe(1)
    expect(snapshot.repairableAlerts).toBe(1)
    expect(snapshot.currentNodes).toBe(1)
    expect(snapshot.healthyNodes).toBe(1)
    expect(snapshot.currentRate).toBeCloseTo(0.5)
    expect(snapshot.completionRate).toBeCloseTo(0.5)

    const alert = snapshot.alerts.find((item) => item.nodeId === 'doc_A')
    expect(alert).toBeTruthy()
    expect(alert?.category).toBe('stale')
    expect(alert?.priority).toBe('high')
    expect(alert?.repairability).toBe('repairable')
    expect(alert?.issueCount).toBe(2)
    expect(alert?.details).toContain('冻结引用孤立')
    expect(alert?.details).toContain('存在更新修订 B')
    expect(alert?.suggestedNodeId).toBe('doc_B')

    const projectSummary = snapshot.projectSummaries.find((item) => item.projectId === 'proj_1')
    expect(projectSummary?.totalNodes).toBe(2)
    expect(projectSummary?.currentNodes).toBe(1)
    expect(projectSummary?.healthyNodes).toBe(1)
    expect(projectSummary?.repairableAlerts).toBe(1)
    expect(projectSummary?.completionRate).toBeCloseTo(0.5)
  })

  test('区分需人工复核与基线参考告警统计', () => {
    const snapshot = analyzeRevisionGovernance(
      [
        {
          id: 'report_A',
          title: '轴承寿命报告 A',
          revisionCode: 'A',
          status: 'draft',
          updatedAt: '2026-04-22T08:00:00.000Z',
          parentId: 'missing_report',
          referenceLock: {
            sourceObjectId: 'missing_report',
            sourceRevisionCode: 'A',
          },
          objectType: 'report',
          projectId: 'proj_2',
          routePath: '/reports',
        },
        {
          id: 'proj_A',
          title: '液压缸项目 A',
          revisionCode: 'A',
          status: 'released',
          updatedAt: '2026-04-23T10:00:00.000Z',
          parentId: null,
          referenceLock: null,
          objectType: 'project',
          projectId: 'proj_A',
          routePath: '/projects',
        },
        {
          id: 'proj_B',
          title: '液压缸项目 B',
          revisionCode: 'B',
          status: 'draft',
          updatedAt: '2026-04-22T10:00:00.000Z',
          parentId: 'proj_A',
          referenceLock: {
            sourceObjectId: 'proj_A',
            sourceRevisionCode: 'A',
            sourceStatus: 'released',
          },
          objectType: 'project',
          projectId: 'proj_B',
          routePath: '/projects',
        },
      ],
      freezeResolver,
    )

    expect(snapshot.reviewAlerts).toBe(1)
    expect(snapshot.referenceAlerts).toBe(1)

    const reviewAlert = snapshot.alerts.find((item) => item.nodeId === 'report_A')
    expect(reviewAlert?.repairability).toBe('review')
    expect(reviewAlert?.suggestedAction).toBe('inspect-current')
    expect(reviewAlert?.priority).toBe('medium')

    const referenceAlert = snapshot.alerts.find((item) => item.nodeId === 'proj_A')
    expect(referenceAlert?.repairability).toBe('reference')
    expect(referenceAlert?.suggestedAction).toBe('keep-baseline')
    expect(referenceAlert?.category).toBe('baseline')
    expect(referenceAlert?.priority).toBe('low')

    const reportSummary = snapshot.projectSummaries.find((item) => item.projectId === 'proj_2')
    expect(reportSummary?.reviewAlerts).toBe(1)
    expect(reportSummary?.completionRate).toBeCloseTo(0)

    const projectSummary = snapshot.projectSummaries.find((item) => item.projectId === 'proj_A')
    expect(projectSummary?.referenceAlerts).toBe(1)
    expect(projectSummary?.currentRate).toBeCloseTo(1)
  })
})
