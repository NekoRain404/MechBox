import { fetchChangeControlSnapshot } from './change-control'
import { fetchEngineeringLibrarySnapshot } from './engineering-library'
import { fetchStoredReportsFresh, getReportModuleMeta, type ReportRecord } from './reporting'
import { fetchWorkflowInsights, type WorkflowInsightsSnapshot } from './workflow-insights'
import { fetchWorkspaceSnapshot, type WorkspaceProject } from './workspace'

export type EngineeringObjectSearchType =
  | 'project'
  | 'report'
  | 'document'
  | 'part'
  | 'supplier-part'
  | 'change'
  | 'approval'
  | 'bom-link'
  | 'run'
  | 'result'

export type EngineeringObjectFilterGroup =
  | 'all'
  | 'document'
  | 'part'
  | 'report'
  | 'project'
  | 'change'
  | 'bom'
  | 'run'

export interface EngineeringObjectSearchItem {
  id: string
  type: EngineeringObjectSearchType
  filterGroup: Exclude<EngineeringObjectFilterGroup, 'all'>
  entityType: string
  entityId: string
  objectType: string
  objectId: string
  title: string
  subtitle: string
  summary?: string
  projectId?: string
  projectName?: string
  module?: string
  status?: string
  revisionCode?: string
  createdAt?: string
  createdBy?: string
  approvalRole?: string
  assigneeName?: string
  changeCode?: string
  reasonText?: string
  impactSummary?: string
  documentKind?: string
  fileName?: string
  mimeType?: string
  storageType?: string
  checksum?: string
  parentEntityId?: string
  previewPayload?: Record<string, unknown> | null
  updatedAt: string
  routePath: string
  sourceLabel: string
  tags: string[]
  keywords: string[]
  searchText: string
}

export interface EngineeringObjectSearchSnapshot {
  activeProject: WorkspaceProject | null
  projects: WorkspaceProject[]
  items: EngineeringObjectSearchItem[]
}

const modulePathMap: Record<string, string> = {
  dashboard: '/',
  tolerances: '/tolerances',
  seals: '/seals',
  bearings: '/bearings',
  bolts: '/bolts',
  drives: '/drives',
  gears: '/gears',
  springs: '/springs',
  hydraulics: '/hydraulics',
  motors: '/motors',
  shafts: '/shafts',
  units: '/units',
  materials: '/materials',
  'standard-parts': '/standard-parts',
  'param-scan': '/param-scan',
  'monte-carlo': '/monte-carlo',
  dfm: '/dfm',
  'failure-diag': '/failure-diag',
  'reverse-identify': '/reverse-identify',
  'material-sub': '/material-sub',
  'excel-import': '/excel-import',
  'latex-report': '/latex-report',
  projects: '/projects',
  reports: '/reports',
  'bom-export': '/bom-export',
  favorites: '/favorites',
  settings: '/settings',
}

const objectTypeLabelMap: Record<string, string> = {
  project: '项目',
  report: '报告',
  document: '文档',
  part: '零件',
  'supplier-part': '供应商料号',
  change: '变更',
  approval: '审批',
  'bom-link': 'BOM 修订',
  run: '运行',
  result: '结果',
}

const objectTypeColorMap: Record<EngineeringObjectSearchType, string> = {
  project: 'blue',
  report: 'cyan',
  document: 'geekblue',
  part: 'green',
  'supplier-part': 'lime',
  change: 'orange',
  approval: 'gold',
  'bom-link': 'purple',
  run: 'processing',
  result: 'magenta',
}

const filterGroupLabelMap: Record<EngineeringObjectFilterGroup, string> = {
  all: '全部对象',
  document: '文档',
  part: '零件',
  report: '报告',
  project: '项目',
  change: '变更',
  bom: 'BOM',
  run: '运行结果',
}

function normalizeText(input: unknown) {
  return String(input ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenizeQuery(query: string) {
  return normalizeText(query)
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean)
}

function compactStrings(values: Array<string | undefined | null>) {
  return values.filter((value): value is string => typeof value === 'string' && value.length > 0)
}

function resolveModulePath(module?: string | null) {
  if (!module) return '/documents'
  return modulePathMap[module] ?? '/documents'
}

function resolveObjectRoutePath(input: {
  objectType?: string | null
  module?: string | null
  fallback?: string
}) {
  if (input.objectType === 'project') return '/projects'
  if (input.objectType === 'report') return '/reports'
  if (input.objectType === 'bom' || input.objectType === 'part') return '/bom-export'
  if (input.fallback) return input.fallback
  return resolveModulePath(input.module)
}

function resolveProjectRef(
  input: {
    projectId?: string | null
    projectName?: string | null
    projectNumber?: string | null
  },
  projects: WorkspaceProject[],
) {
  const byId = input.projectId ? projects.find((project) => project.id === input.projectId) : null
  if (byId) {
    return {
      projectId: byId.id,
      projectName: byId.name,
    }
  }

  const byName = input.projectName ? projects.find((project) => project.name === input.projectName) : null
  if (byName) {
    return {
      projectId: byName.id,
      projectName: byName.name,
    }
  }

  const byNumber = input.projectNumber ? projects.find((project) => project.id === input.projectNumber) : null
  if (byNumber) {
    return {
      projectId: byNumber.id,
      projectName: byNumber.name,
    }
  }

  return {
    projectId: input.projectId ?? input.projectNumber ?? undefined,
    projectName: input.projectName ?? undefined,
  }
}

function buildSearchItem(
  item: Omit<EngineeringObjectSearchItem, 'searchText'>,
): EngineeringObjectSearchItem {
  const searchText = normalizeText([
    item.type,
    item.filterGroup,
    item.objectType,
    item.objectId,
    item.title,
    item.subtitle,
    item.summary,
    item.projectId,
    item.projectName,
    item.module,
    item.status,
    item.sourceLabel,
    ...item.tags,
    ...item.keywords,
  ].join(' '))

  return {
    ...item,
    searchText,
  }
}

function buildProjectItems(projects: WorkspaceProject[]) {
  return projects.map((project) =>
    buildSearchItem({
      id: `project:${project.id}`,
      type: 'project',
      filterGroup: 'project',
      entityType: 'workflow-project',
      entityId: project.id,
      objectType: 'project',
      objectId: project.id,
      title: project.name,
      subtitle: `${getReportModuleMeta(project.module).label} · ${project.lifecycleStatus} · 修订 ${project.revisionCode}`,
      summary: project.inputSummary,
      projectId: project.id,
      projectName: project.name,
      module: project.module,
      status: project.lifecycleStatus,
      revisionCode: project.revisionCode,
      createdAt: project.createdAt,
      previewPayload: {
        version: project.version,
        lifecycleStatus: project.lifecycleStatus,
        revisionCode: project.revisionCode,
        inputSummary: project.inputSummary,
      },
      updatedAt: project.updatedAt,
      routePath: '/projects',
      sourceLabel: '项目主数据',
      tags: [project.lifecycleStatus, project.revisionCode],
      keywords: [project.id, project.name, project.module, project.version, project.status, project.inputSummary],
    }),
  )
}

function buildReportItems(reports: ReportRecord[], projects: WorkspaceProject[]) {
  return reports.map((report) => {
    const projectRef = resolveProjectRef(report, projects)
    return buildSearchItem({
      id: `report:${report.id}`,
      type: 'report',
      filterGroup: 'report',
      entityType: 'workflow-report',
      entityId: report.id,
      objectType: 'report',
      objectId: report.id,
      title: report.title,
      subtitle: `${getReportModuleMeta(report.module).label} · ${report.type.toUpperCase()} · ${report.workflowStatus ?? report.status}`,
      summary: report.summary,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: report.module,
      status: report.workflowStatus ?? report.status,
      revisionCode: report.revisionCode,
      createdAt: report.createdAt,
      createdBy: report.author,
      previewPayload: {
        reportType: report.type,
        workflowStatus: report.workflowStatus ?? report.status,
        sourceKind: report.sourceKind ?? 'module-result',
        standardRef: report.standardRef ?? null,
        projectNumber: report.projectNumber ?? null,
        linkedRunId: report.linkedRunId ?? null,
        linkedResultId: report.linkedResultId ?? null,
        summary: report.summary ?? null,
        derivationMeta: report.derivationMeta ?? null,
      },
      updatedAt: report.createdAt,
      routePath: '/reports',
      sourceLabel: '报告归档',
      tags: [report.type, report.sourceKind ?? 'module-result', report.workflowStatus ?? report.status],
      keywords: compactStrings([
        report.id,
        report.title,
        report.module,
        report.projectId,
        report.projectName,
        report.projectNumber,
        report.standardRef,
        report.author,
        report.summary,
        report.derivationMeta?.derivedFromReportId,
        report.derivationMeta?.sourceRevisionCode,
        report.derivationMeta?.nextRevisionCode,
      ]),
    })
  })
}

function buildRunItems(data: WorkflowInsightsSnapshot, projects: WorkspaceProject[]) {
  const runItems = data.runs.map((run) => {
    const projectRef = resolveProjectRef(run, projects)
    return buildSearchItem({
      id: `run:${run.id}`,
      type: 'run',
      filterGroup: 'run',
      entityType: 'calculation-run',
      entityId: run.id,
      objectType: 'run',
      objectId: run.id,
      title: run.name,
      subtitle: `${getReportModuleMeta(run.module).label} · ${run.sourceKind}`,
      summary: run.summary,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: run.module,
      status: run.sourceKind,
      createdAt: run.createdAt,
      previewPayload: {
        sourceKind: run.sourceKind,
        summary: run.summary ?? null,
        inputData: run.inputData ?? null,
        outputData: run.outputData ?? null,
        metadata: run.metadata ?? null,
      },
      updatedAt: run.createdAt,
      routePath: resolveModulePath(run.module),
      sourceLabel: '正式运行记录',
      tags: [run.sourceKind],
      keywords: compactStrings([run.id, run.name, run.module, run.summary, run.projectId, run.projectName, run.projectNumber]),
    })
  })

  const runMap = new Map(data.runs.map((run) => [run.id, run]))
  const resultItems = data.results.map((result) => {
    const run = runMap.get(result.runId)
    const projectRef = resolveProjectRef(run ?? {}, projects)
    return buildSearchItem({
      id: `result:${result.id}`,
      type: 'result',
      filterGroup: 'run',
      entityType: 'calculation-result',
      entityId: result.id,
      objectType: 'result',
      objectId: result.id,
      title: result.summary?.trim() || `${getReportModuleMeta(result.module).label} 结果对象`,
      subtitle: `${getReportModuleMeta(result.module).label} · ${result.resultKind} · ${result.status}`,
      summary: run?.summary,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: result.module,
      status: result.status,
      createdAt: result.createdAt,
      previewPayload: {
        resultKind: result.resultKind,
        summary: result.summary ?? null,
        outputData: result.outputData ?? null,
        derivedMetrics: result.derivedMetrics ?? null,
      },
      updatedAt: result.updatedAt,
      routePath: resolveModulePath(result.module),
      sourceLabel: '正式结果对象',
      tags: [result.resultKind, result.status],
      keywords: compactStrings([result.id, result.runId, result.module, result.summary, run?.name, run?.summary]),
    })
  })

  return [...runItems, ...resultItems]
}

function buildChangeItems(
  changeSnapshot: Awaited<ReturnType<typeof fetchChangeControlSnapshot>>,
  projects: WorkspaceProject[],
) {
  const changeItems = changeSnapshot.changes.map((change) => {
    const projectRef = resolveProjectRef(change, projects)
    return buildSearchItem({
      id: `change:${change.id}`,
      type: 'change',
      filterGroup: 'change',
      entityType: 'change-case',
      entityId: change.id,
      objectType: change.objectType,
      objectId: change.objectId,
      title: change.title,
      subtitle: `${objectTypeLabelMap[change.objectType] ?? change.objectType} · ${change.status} · 修订 ${change.revisionCode ?? 'A'}`,
      summary: change.impactSummary || change.reason,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: change.module,
      status: change.status,
      revisionCode: change.revisionCode,
      createdAt: change.requestedAt,
      createdBy: change.requestedBy,
      changeCode: change.changeCode,
      reasonText: change.reason,
      impactSummary: change.impactSummary,
      previewPayload: {
        changeCode: change.changeCode ?? null,
        reason: change.reason ?? null,
        impactSummary: change.impactSummary ?? null,
        revisionCode: change.revisionCode ?? 'A',
        payload: change.payload ?? null,
      },
      updatedAt: change.effectiveAt ?? change.requestedAt,
      routePath: resolveObjectRoutePath({
        objectType: change.objectType,
        module: change.module,
        fallback: '/projects',
      }),
      sourceLabel: '变更控制',
      tags: [change.status, change.revisionCode ?? 'A'],
      keywords: compactStrings([
        change.id,
        change.objectId,
        change.changeCode,
        change.title,
        change.module,
        change.reason,
        change.impactSummary,
        change.requestedBy,
      ]),
    })
  })

  const approvalItems = changeSnapshot.approvals.map((approval) => {
    const projectRef = resolveProjectRef(approval, projects)
    return buildSearchItem({
      id: `approval:${approval.id}`,
      type: 'approval',
      filterGroup: 'change',
      entityType: 'approval-task',
      entityId: approval.id,
      objectType: approval.objectType,
      objectId: approval.objectId,
      title: approval.title,
      subtitle: `${objectTypeLabelMap[approval.objectType] ?? approval.objectType} · ${approval.decisionStatus} · ${approval.approvalRole ?? '审批任务'}`,
      summary: approval.comment,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: approval.module,
      status: approval.decisionStatus,
      createdAt: approval.createdAt,
      approvalRole: approval.approvalRole,
      assigneeName: approval.assigneeName,
      parentEntityId: approval.changeId,
      previewPayload: {
        approvalRole: approval.approvalRole ?? null,
        assigneeName: approval.assigneeName ?? null,
        decisionStatus: approval.decisionStatus,
        comment: approval.comment ?? null,
        dueAt: approval.dueAt ?? null,
        payload: approval.payload ?? null,
      },
      updatedAt: approval.updatedAt,
      routePath: resolveObjectRoutePath({
        objectType: approval.objectType,
        module: approval.module,
        fallback: '/projects',
      }),
      sourceLabel: '审批任务',
      tags: [approval.decisionStatus, approval.approvalRole ?? ''],
      keywords: compactStrings([
        approval.id,
        approval.objectId,
        approval.changeId,
        approval.title,
        approval.approvalRole,
        approval.assigneeName,
        approval.comment,
      ]),
    })
  })

  return [...changeItems, ...approvalItems]
}

function buildEngineeringLibraryItems(
  engineeringSnapshot: Awaited<ReturnType<typeof fetchEngineeringLibrarySnapshot>>,
  projects: WorkspaceProject[],
  reports: ReportRecord[],
) {
  const reportMap = new Map(reports.map((report) => [report.id, report]))
  const partMap = new Map(engineeringSnapshot.partMasters.map((part) => [part.id, part]))

  const partItems = engineeringSnapshot.partMasters.map((part) => {
    const projectRef = resolveProjectRef(part, projects)
    return buildSearchItem({
      id: `part:${part.id}`,
      type: 'part',
      filterGroup: 'part',
      entityType: 'part-master',
      entityId: part.id,
      objectType: 'part',
      objectId: part.id,
      title: `${part.partNumber} · ${part.partName}`,
      subtitle: `${part.category} · ${part.lifecycleStatus ?? 'draft'} · 修订 ${part.revisionCode ?? 'A'}`,
      summary: part.standardRef,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: 'bom-export',
      status: part.lifecycleStatus,
      revisionCode: part.revisionCode,
      createdAt: part.createdAt,
      previewPayload: {
        partNumber: part.partNumber,
        partName: part.partName,
        category: part.category,
        standardRef: part.standardRef ?? null,
        materialCode: part.materialCode ?? null,
        preferredSupplierName: part.preferredSupplierName ?? null,
        latestSupplierPartNo: part.latestSupplierPartNo ?? null,
        metadata: part.metadata ?? null,
      },
      updatedAt: part.updatedAt,
      routePath: '/bom-export',
      sourceLabel: '零件主数据',
      tags: [part.category, part.lifecycleStatus ?? 'draft'],
      keywords: compactStrings([
        part.id,
        part.partNumber,
        part.partName,
        part.category,
        part.standardRef,
        part.materialCode,
        part.preferredSupplierName,
        part.latestSupplierPartNo,
      ]),
    })
  })

  const supplierPartItems = engineeringSnapshot.supplierParts.map((item) => {
    const linkedPart = partMap.get(item.partId)
    const projectRef = resolveProjectRef(linkedPart ?? {}, projects)
    return buildSearchItem({
      id: `supplier-part:${item.id}`,
      type: 'supplier-part',
      filterGroup: 'part',
      entityType: 'supplier-part',
      entityId: item.id,
      objectType: 'part',
      objectId: item.partId,
      title: `${item.supplierName} · ${item.supplierPartNo}`,
      subtitle: `${linkedPart?.partNumber ?? item.partId} · ${linkedPart?.partName ?? '未关联零件'}`,
      summary: item.manufacturerName,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: 'bom-export',
      status: item.preferredFlag ? 'preferred' : 'candidate',
      createdAt: item.createdAt,
      previewPayload: {
        supplierName: item.supplierName,
        supplierPartNo: item.supplierPartNo,
        manufacturerName: item.manufacturerName ?? null,
        unitCost: item.unitCost ?? null,
        currencyCode: item.currencyCode ?? null,
        moq: item.moq ?? null,
        leadTimeDays: item.leadTimeDays ?? null,
        preferredFlag: item.preferredFlag ?? false,
        metadata: item.metadata ?? null,
      },
      updatedAt: item.updatedAt,
      routePath: '/bom-export',
      sourceLabel: '供应商料号',
      tags: [item.currencyCode ?? '', item.preferredFlag ? 'preferred' : ''],
      keywords: compactStrings([
        item.id,
        item.partId,
        item.supplierName,
        item.supplierPartNo,
        item.manufacturerName,
        item.currencyCode,
      ]),
    })
  })

  const bomLinkItems = engineeringSnapshot.bomRevisionLinks.map((item) => {
    const linkedPart = partMap.get(item.partId)
    const projectRef = resolveProjectRef(linkedPart ?? {}, projects)
    return buildSearchItem({
      id: `bom-link:${item.id}`,
      type: 'bom-link',
      filterGroup: 'bom',
      entityType: 'bom-revision-link',
      entityId: item.id,
      objectType: 'bom',
      objectId: item.bomId,
      title: `${item.bomId} · 行 ${item.lineNo}`,
      subtitle: `${linkedPart?.partNumber ?? item.partId} · 数量 ${item.quantity} · 修订 ${item.revisionCode ?? 'A'}`,
      summary: linkedPart?.partName,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: 'bom-export',
      status: item.revisionCode,
      revisionCode: item.revisionCode,
      createdAt: item.createdAt,
      previewPayload: {
        bomId: item.bomId,
        partId: item.partId,
        lineNo: item.lineNo,
        quantity: item.quantity,
        sourceItemId: item.sourceItemId ?? null,
        metadata: item.metadata ?? null,
      },
      updatedAt: item.updatedAt,
      routePath: '/bom-export',
      sourceLabel: 'BOM 修订链',
      tags: [item.revisionCode ?? 'A'],
      keywords: compactStrings([item.id, item.bomId, item.partId, item.sourceItemId, linkedPart?.partNumber, linkedPart?.partName]),
    })
  })

  const documentItems = engineeringSnapshot.documentAttachments.map((document) => {
    const projectRef = resolveProjectRef(document, projects)
    const linkedReport = document.objectType === 'report' ? reportMap.get(document.objectId) : null
    const linkedPart = document.objectType === 'part' ? partMap.get(document.objectId) : null
    const routePath = resolveObjectRoutePath({
      objectType: document.objectType,
      module: document.module,
      fallback: document.objectType === 'bom' ? '/bom-export' : '/documents',
    })
    return buildSearchItem({
      id: `document:${document.id}`,
      type: 'document',
      filterGroup: 'document',
      entityType: 'document-attachment',
      entityId: document.id,
      objectType: document.objectType,
      objectId: document.objectId,
      title: document.title,
      subtitle: `${objectTypeLabelMap[document.objectType] ?? document.objectType} · ${document.documentKind} · ${document.status ?? 'draft'}`,
      summary: linkedReport?.title ?? linkedPart?.partName ?? document.fileName,
      projectId: projectRef.projectId,
      projectName: projectRef.projectName,
      module: document.module,
      status: document.status,
      revisionCode: document.revisionCode,
      createdAt: document.createdAt,
      createdBy: document.createdBy,
      documentKind: document.documentKind,
      fileName: document.fileName,
      mimeType: document.mimeType,
      storageType: document.storageType,
      checksum: document.checksum,
      previewPayload: {
        documentKind: document.documentKind,
        fileName: document.fileName ?? null,
        mimeType: document.mimeType ?? null,
        storageType: document.storageType ?? null,
        checksum: document.checksum ?? null,
        payload: document.payload ?? null,
      },
      updatedAt: document.createdAt,
      routePath,
      sourceLabel: '文档附件',
      tags: [document.documentKind, document.storageType ?? '', document.status ?? 'draft'],
      keywords: compactStrings([
        document.id,
        document.objectId,
        document.objectType,
        document.title,
        document.fileName,
        document.documentKind,
        document.mimeType,
        document.storageType,
        document.createdBy,
        linkedReport?.title,
        linkedPart?.partNumber,
        linkedPart?.partName,
      ]),
    })
  })

  return [...partItems, ...supplierPartItems, ...bomLinkItems, ...documentItems]
}

export async function fetchEngineeringObjectSearchSnapshot() {
  const [workspaceSnapshot, reports, workflowInsights, changeSnapshot, engineeringSnapshot] = await Promise.all([
    fetchWorkspaceSnapshot(),
    fetchStoredReportsFresh(),
    fetchWorkflowInsights({ runLimit: 240, resultLimit: 360, snapshotLimit: 240 }),
    fetchChangeControlSnapshot({ changeLimit: 240, approvalLimit: 320, eventLimit: 200 }),
    fetchEngineeringLibrarySnapshot({ limit: 320 }),
  ])

  const items = [
    ...buildProjectItems(workspaceSnapshot.projects),
    ...buildReportItems(reports, workspaceSnapshot.projects),
    ...buildRunItems(workflowInsights, workspaceSnapshot.projects),
    ...buildChangeItems(changeSnapshot, workspaceSnapshot.projects),
    ...buildEngineeringLibraryItems(engineeringSnapshot, workspaceSnapshot.projects, reports),
  ].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))

  return {
    activeProject: workspaceSnapshot.activeProject,
    projects: workspaceSnapshot.projects,
    items,
  } satisfies EngineeringObjectSearchSnapshot
}

export function searchEngineeringObjects(
  items: EngineeringObjectSearchItem[],
  options?: {
    query?: string
    filterGroup?: EngineeringObjectFilterGroup
    projectId?: string | null
  },
) {
  const tokens = tokenizeQuery(options?.query ?? '')
  const projectId = options?.projectId ?? null

  return items.filter((item) => {
    if (options?.filterGroup && options.filterGroup !== 'all' && item.filterGroup !== options.filterGroup) {
      return false
    }
    if (projectId && item.projectId !== projectId) {
      return false
    }
    if (!tokens.length) return true
    return tokens.every((token) => item.searchText.includes(token))
  })
}

export function buildEngineeringObjectGroupStats(items: EngineeringObjectSearchItem[]) {
  const stats: Record<EngineeringObjectFilterGroup, number> = {
    all: items.length,
    document: 0,
    part: 0,
    report: 0,
    project: 0,
    change: 0,
    bom: 0,
    run: 0,
  }

  for (const item of items) {
    stats[item.filterGroup] += 1
  }

  return stats
}

export function getEngineeringObjectTypeMeta(type: EngineeringObjectSearchType) {
  return {
    label: objectTypeLabelMap[type],
    color: objectTypeColorMap[type],
  }
}

export function getEngineeringObjectFilterMeta(group: EngineeringObjectFilterGroup) {
  return {
    label: filterGroupLabelMap[group],
    color:
      group === 'all'
        ? 'default'
        : group === 'document'
          ? 'geekblue'
          : group === 'part'
            ? 'green'
            : group === 'report'
              ? 'cyan'
              : group === 'project'
                ? 'blue'
                : group === 'change'
                  ? 'orange'
                  : group === 'bom'
                    ? 'purple'
                    : 'processing',
  }
}
