import { getDatabase } from './database'

type WorkflowProjectRecord = {
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

type WorkflowReportRecord = {
  id: string
  title: string
  module: string
  createdAt: string
  type: 'pdf' | 'csv' | 'json'
  status: 'generated' | 'pending'
  projectNumber?: string
  projectId?: string
  projectName?: string
  standardRef?: string
  author?: string
  summary?: string
  sourceKind?: 'module-result' | 'analysis-export' | 'archive-report' | 'manual-report'
  linkedRunId?: string
  linkedResultId?: string
  revisionCode?: string
  workflowStatus?: 'draft' | 'in-review' | 'approved' | 'released' | 'archived'
}

type WorkflowBomItem = {
  id: string
  category: string
  designation: string
  description: string
  quantity: number
  standard?: string
  material?: string
  supplier?: string
  supplierPartNo?: string
  unitCost?: number
  totalCost?: number
}

type WorkflowBomDraft = {
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
  items: WorkflowBomItem[]
}

type WorkflowCalculationRunRecord = {
  id: string
  module: string
  name: string
  createdAt: string
  projectId?: string
  projectNumber?: string
  projectName?: string
  sourceKind: 'recent-calculation' | 'pdf-export' | 'analysis-export' | 'archive-report' | 'manual-report'
  summary?: string
  linkedReportId?: string
  inputData?: unknown
  outputData?: unknown
  metadata?: Record<string, unknown> | null
}

type WorkflowScenarioSnapshotRecord = {
  id: string
  runId: string
  module: string
  snapshotKind: 'input' | 'context' | 'decision'
  title?: string
  summary?: string
  inputData?: unknown
  contextData?: unknown
  createdAt: string
}

type WorkflowCalculationResultRecord = {
  id: string
  runId: string
  module: string
  resultKind: 'primary' | 'summary' | 'distribution' | 'recommendation' | 'comparison' | 'analysis'
  status: 'computed' | 'warning' | 'error' | 'archived'
  summary?: string
  outputData?: unknown
  derivedMetrics?: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

type WorkflowArtifactBundleRecord = {
  run: WorkflowCalculationRunRecord
  snapshots?: WorkflowScenarioSnapshotRecord[]
  results?: WorkflowCalculationResultRecord[]
}

type WorkflowPartMasterRecord = {
  id: string
  projectId?: string
  partNumber: string
  partName: string
  category: string
  standardRef?: string
  materialCode?: string
  preferredSupplierName?: string
  latestSupplierPartNo?: string
  revisionCode?: string
  lifecycleStatus?: 'draft' | 'in-review' | 'approved' | 'released' | 'archived'
  sourceKind?: 'derived-bom' | 'manual' | 'imported'
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown> | null
}

type WorkflowSupplierPartRecord = {
  id: string
  partId: string
  supplierName: string
  supplierPartNo: string
  manufacturerName?: string
  unitCost?: number
  currencyCode?: string
  moq?: number
  leadTimeDays?: number
  preferredFlag?: boolean
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown> | null
}

type WorkflowBomRevisionLinkRecord = {
  id: string
  bomId: string
  partId: string
  revisionCode?: string
  lineNo: number
  quantity: number
  sourceItemId?: string
  createdAt: string
  updatedAt: string
  metadata?: Record<string, unknown> | null
}

type WorkflowDocumentAttachmentRecord = {
  id: string
  projectId?: string
  objectType: 'project' | 'report' | 'bom' | 'run' | 'result' | 'part' | 'document'
  objectId: string
  module?: string
  documentKind: 'pdf' | 'csv' | 'json' | 'image' | 'note' | 'package' | 'snapshot' | 'spec'
  title: string
  fileName?: string
  mimeType?: string
  storageType?: 'embedded' | 'export-reference' | 'local-path'
  revisionCode?: string
  createdAt: string
  createdBy?: string
  status?: 'draft' | 'generated' | 'released' | 'archived'
  checksum?: string
  payload?: Record<string, unknown> | null
}

type WorkflowChangeObjectType = 'project' | 'report' | 'bom' | 'run' | 'result' | 'part' | 'document'

type WorkflowChangeCaseRecord = {
  id: string
  projectId?: string
  objectType: WorkflowChangeObjectType
  objectId: string
  changeCode?: string
  title: string
  module?: string
  reason?: string
  impactSummary?: string
  requestedBy?: string
  requestedAt: string
  effectiveAt?: string
  status: 'draft' | 'in-review' | 'approved' | 'released' | 'rejected' | 'archived'
  revisionCode?: string
  payload?: Record<string, unknown> | null
}

type WorkflowApprovalTaskRecord = {
  id: string
  changeId?: string
  projectId?: string
  objectType: WorkflowChangeObjectType
  objectId: string
  module?: string
  title: string
  approvalRole?: string
  assigneeName?: string
  decisionStatus: 'pending' | 'approved' | 'rejected' | 'waived'
  dueAt?: string
  decidedAt?: string
  comment?: string
  seqNo?: number
  createdAt: string
  updatedAt: string
  payload?: Record<string, unknown> | null
}

type WorkflowObjectEventLogRecord = {
  id: string
  objectType: WorkflowChangeObjectType
  objectId: string
  projectId?: string
  module?: string
  eventType:
    | 'created'
    | 'updated'
    | 'opened'
    | 'status-changed'
    | 'approval-requested'
    | 'approval-decided'
    | 'exported'
    | 'imported'
    | 'deleted'
    | 'archived'
    | 'restored'
    | 'calculated'
    | 'linked'
  summary: string
  actorName?: string
  eventAt: string
  payload?: Record<string, unknown> | null
}

function deleteMissingByIds(table: string, column: string, ids: string[]) {
  const db = getDatabase()
  if (!ids.length) {
    db.prepare(`DELETE FROM ${table}`).run()
    return
  }
  const placeholders = ids.map(() => '?').join(', ')
  db.prepare(`DELETE FROM ${table} WHERE ${column} NOT IN (${placeholders})`).run(...ids)
}

function resolveExistingProjectId(projectId?: string | null) {
  if (!projectId) return null
  const row = getDatabase()
    .prepare('SELECT project_id FROM workflow_project WHERE project_id = ?')
    .get(projectId) as { project_id?: string } | undefined
  return row?.project_id ?? null
}

function resolveExistingReportId(reportId?: string | null) {
  if (!reportId) return null
  const row = getDatabase()
    .prepare('SELECT report_id FROM report_artifact WHERE report_id = ?')
    .get(reportId) as { report_id?: string } | undefined
  return row?.report_id ?? null
}

function parseJsonValue<T = unknown>(value?: string | null) {
  if (!value) return undefined
  return JSON.parse(value) as T
}

function normalizeCalculationRunRow(row: any): WorkflowCalculationRunRecord | null {
  if (!row) return null
  return {
    ...row,
    inputData: parseJsonValue(row.inputJson),
    outputData: parseJsonValue(row.outputJson),
    metadata: parseJsonValue<Record<string, unknown> | null>(row.metadataJson) ?? null,
  }
}

function normalizeScenarioSnapshotRow(row: any): WorkflowScenarioSnapshotRecord | null {
  if (!row) return null
  return {
    ...row,
    inputData: parseJsonValue(row.inputJson),
    contextData: parseJsonValue(row.contextJson),
  }
}

function normalizeCalculationResultRow(row: any): WorkflowCalculationResultRecord | null {
  if (!row) return null
  return {
    ...row,
    outputData: parseJsonValue(row.outputJson),
    derivedMetrics: parseJsonValue<Record<string, unknown> | null>(row.derivedMetricsJson) ?? null,
  }
}

function normalizeChangeCaseRow(row: any): WorkflowChangeCaseRecord | null {
  if (!row) return null
  return {
    ...row,
    payload: parseJsonValue<Record<string, unknown> | null>(row.payloadJson) ?? null,
  }
}

function normalizeApprovalTaskRow(row: any): WorkflowApprovalTaskRecord | null {
  if (!row) return null
  return {
    ...row,
    payload: parseJsonValue<Record<string, unknown> | null>(row.payloadJson) ?? null,
  }
}

function normalizeObjectEventLogRow(row: any): WorkflowObjectEventLogRecord | null {
  if (!row) return null
  return {
    ...row,
    payload: parseJsonValue<Record<string, unknown> | null>(row.payloadJson) ?? null,
  }
}

function normalizePartMasterRow(row: any): WorkflowPartMasterRecord | null {
  if (!row) return null
  return {
    ...row,
    metadata: parseJsonValue<Record<string, unknown> | null>(row.metadataJson) ?? null,
  }
}

function normalizeSupplierPartRow(row: any): WorkflowSupplierPartRecord | null {
  if (!row) return null
  return {
    ...row,
    preferredFlag: Boolean(row.preferredFlag),
    metadata: parseJsonValue<Record<string, unknown> | null>(row.metadataJson) ?? null,
  }
}

function normalizeBomRevisionLinkRow(row: any): WorkflowBomRevisionLinkRecord | null {
  if (!row) return null
  return {
    ...row,
    metadata: parseJsonValue<Record<string, unknown> | null>(row.metadataJson) ?? null,
  }
}

function normalizeDocumentAttachmentRow(row: any): WorkflowDocumentAttachmentRecord | null {
  if (!row) return null
  return {
    ...row,
    payload: parseJsonValue<Record<string, unknown> | null>(row.payloadJson) ?? null,
  }
}

function slugifyIdentifier(value: string) {
  return value.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'item'
}

function appendObjectEventLogInternal(record: WorkflowObjectEventLogRecord) {
  const db = getDatabase()
  const linkedProjectId = resolveExistingProjectId(record.projectId ?? null)
  db.prepare(
    `
    INSERT INTO object_event_log (
      event_id, object_type, object_id, project_id, module_code, event_type, event_summary, actor_name, event_at, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(event_id) DO UPDATE SET
      object_type = excluded.object_type,
      object_id = excluded.object_id,
      project_id = excluded.project_id,
      module_code = excluded.module_code,
      event_type = excluded.event_type,
      event_summary = excluded.event_summary,
      actor_name = excluded.actor_name,
      event_at = excluded.event_at,
      payload_json = excluded.payload_json
    `,
  ).run(
    record.id,
    record.objectType,
    record.objectId,
    linkedProjectId,
    record.module ?? null,
    record.eventType,
    record.summary,
    record.actorName ?? null,
    record.eventAt,
    record.payload == null ? null : JSON.stringify(record.payload),
  )
}

function appendDocumentAttachmentInternal(record: WorkflowDocumentAttachmentRecord) {
  const db = getDatabase()
  const linkedProjectId = resolveExistingProjectId(record.projectId ?? null)
  db.prepare(
    `
    INSERT INTO document_attachment (
      document_id, project_id, object_type, object_id, module_code, document_kind, title,
      file_name, mime_type, storage_type, revision_code, created_at, created_by, status, checksum, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(document_id) DO UPDATE SET
      project_id = excluded.project_id,
      object_type = excluded.object_type,
      object_id = excluded.object_id,
      module_code = excluded.module_code,
      document_kind = excluded.document_kind,
      title = excluded.title,
      file_name = excluded.file_name,
      mime_type = excluded.mime_type,
      storage_type = excluded.storage_type,
      revision_code = excluded.revision_code,
      created_at = excluded.created_at,
      created_by = excluded.created_by,
      status = excluded.status,
      checksum = excluded.checksum,
      payload_json = excluded.payload_json
    `,
  ).run(
    record.id,
    linkedProjectId,
    record.objectType,
    record.objectId,
    record.module ?? null,
    record.documentKind,
    record.title,
    record.fileName ?? null,
    record.mimeType ?? null,
    record.storageType ?? 'export-reference',
    record.revisionCode ?? 'A',
    record.createdAt,
    record.createdBy ?? null,
    record.status ?? 'generated',
    record.checksum ?? null,
    record.payload == null ? null : JSON.stringify(record.payload),
  )
}

function upsertPartMasterInternal(record: WorkflowPartMasterRecord) {
  const db = getDatabase()
  const linkedProjectId = resolveExistingProjectId(record.projectId ?? null)
  db.prepare(
    `
    INSERT INTO part_master (
      part_id, project_id, part_number, part_name, category_code, standard_ref, material_code,
      preferred_supplier_name, latest_supplier_part_no, revision_code, lifecycle_status, source_kind,
      created_at, updated_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(part_id) DO UPDATE SET
      project_id = excluded.project_id,
      part_number = excluded.part_number,
      part_name = excluded.part_name,
      category_code = excluded.category_code,
      standard_ref = excluded.standard_ref,
      material_code = excluded.material_code,
      preferred_supplier_name = excluded.preferred_supplier_name,
      latest_supplier_part_no = excluded.latest_supplier_part_no,
      revision_code = excluded.revision_code,
      lifecycle_status = excluded.lifecycle_status,
      source_kind = excluded.source_kind,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      metadata_json = excluded.metadata_json
    `,
  ).run(
    record.id,
    linkedProjectId,
    record.partNumber,
    record.partName,
    record.category,
    record.standardRef ?? null,
    record.materialCode ?? null,
    record.preferredSupplierName ?? null,
    record.latestSupplierPartNo ?? null,
    record.revisionCode ?? 'A',
    record.lifecycleStatus ?? 'draft',
    record.sourceKind ?? 'derived-bom',
    record.createdAt,
    record.updatedAt,
    record.metadata == null ? null : JSON.stringify(record.metadata),
  )
}

function upsertSupplierPartInternal(record: WorkflowSupplierPartRecord) {
  const db = getDatabase()
  db.prepare(
    `
    INSERT INTO supplier_part (
      supplier_part_id, part_id, supplier_name, supplier_part_no, manufacturer_name, unit_cost,
      currency_code, moq, lead_time_days, preferred_flag, created_at, updated_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(supplier_part_id) DO UPDATE SET
      part_id = excluded.part_id,
      supplier_name = excluded.supplier_name,
      supplier_part_no = excluded.supplier_part_no,
      manufacturer_name = excluded.manufacturer_name,
      unit_cost = excluded.unit_cost,
      currency_code = excluded.currency_code,
      moq = excluded.moq,
      lead_time_days = excluded.lead_time_days,
      preferred_flag = excluded.preferred_flag,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      metadata_json = excluded.metadata_json
    `,
  ).run(
    record.id,
    record.partId,
    record.supplierName,
    record.supplierPartNo,
    record.manufacturerName ?? null,
    record.unitCost ?? null,
    record.currencyCode ?? 'CNY',
    record.moq ?? null,
    record.leadTimeDays ?? null,
    record.preferredFlag ? 1 : 0,
    record.createdAt,
    record.updatedAt,
    record.metadata == null ? null : JSON.stringify(record.metadata),
  )
}

function syncBomDerivedObjects(input: {
  bomId: string
  projectId?: string | null
  revisionCode?: string
  sourceKind?: 'manual' | 'derived' | 'imported'
  items: WorkflowBomItem[]
  createdAt: string
  updatedAt: string
}) {
  const db = getDatabase()
  const linkedProjectId = resolveExistingProjectId(input.projectId ?? null)
  const revisionCode = input.revisionCode ?? 'A'
  const deleteLinks = db.prepare('DELETE FROM bom_revision_link WHERE bom_id = ?')
  const insertLink = db.prepare(
    `
    INSERT INTO bom_revision_link (
      link_id, bom_id, part_id, revision_code, line_no, quantity, source_item_id, created_at, updated_at, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(link_id) DO UPDATE SET
      bom_id = excluded.bom_id,
      part_id = excluded.part_id,
      revision_code = excluded.revision_code,
      line_no = excluded.line_no,
      quantity = excluded.quantity,
      source_item_id = excluded.source_item_id,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      metadata_json = excluded.metadata_json
    `,
  )

  db.transaction(() => {
    deleteLinks.run(input.bomId)
    input.items.forEach((item, index) => {
      const partId = `part_${slugifyIdentifier(linkedProjectId ?? 'global')}_${slugifyIdentifier(item.category)}_${slugifyIdentifier(item.designation)}`
      upsertPartMasterInternal({
        id: partId,
        projectId: linkedProjectId ?? undefined,
        partNumber: item.designation,
        partName: item.description,
        category: item.category,
        standardRef: item.standard,
        materialCode: item.material,
        preferredSupplierName: item.supplier,
        latestSupplierPartNo: item.supplierPartNo,
        revisionCode,
        lifecycleStatus: 'draft',
        sourceKind: input.sourceKind === 'imported' ? 'imported' : input.sourceKind === 'manual' ? 'manual' : 'derived-bom',
        createdAt: input.createdAt,
        updatedAt: input.updatedAt,
        metadata: {
          quantity: item.quantity,
          unitCost: item.unitCost ?? null,
          totalCost: item.totalCost ?? null,
        },
      })

      if (item.supplier && item.supplierPartNo) {
        upsertSupplierPartInternal({
          id: `sp_${slugifyIdentifier(partId)}_${slugifyIdentifier(item.supplier)}_${slugifyIdentifier(item.supplierPartNo)}`,
          partId,
          supplierName: item.supplier,
          supplierPartNo: item.supplierPartNo,
          manufacturerName: item.supplier,
          unitCost: item.unitCost,
          currencyCode: 'CNY',
          preferredFlag: true,
          createdAt: input.createdAt,
          updatedAt: input.updatedAt,
          metadata: {
            standardRef: item.standard ?? null,
          },
        })
      }

      insertLink.run(
        `bomlnk_${slugifyIdentifier(input.bomId)}_${index + 1}`,
        input.bomId,
        partId,
        revisionCode,
        index + 1,
        item.quantity,
        item.id,
        input.createdAt,
        input.updatedAt,
        JSON.stringify({
          designation: item.designation,
          description: item.description,
          supplier: item.supplier ?? null,
          supplierPartNo: item.supplierPartNo ?? null,
        }),
      )
    })
  })()
}

export function listWorkflowProjects(): WorkflowProjectRecord[] {
  return getDatabase()
    .prepare(
      `
      SELECT
        project_id AS id,
        project_name AS name,
        module_code AS module,
        created_at AS createdAt,
        updated_at AS updatedAt,
        version_label AS version,
        revision_code AS revisionCode,
        COALESCE(input_summary, '') AS inputSummary,
        status,
        lifecycle_status AS lifecycleStatus
      FROM workflow_project
      ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
      `,
    )
    .all() as WorkflowProjectRecord[]
}

export function replaceWorkflowProjects(projects: WorkflowProjectRecord[]) {
  const db = getDatabase()
  const upsertProject = db.prepare(
    `
    INSERT INTO workflow_project (
      project_id, project_name, module_code, created_at, updated_at, version_label, revision_code, input_summary, status, lifecycle_status, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
    ON CONFLICT(project_id) DO UPDATE SET
      project_name = excluded.project_name,
      module_code = excluded.module_code,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      version_label = excluded.version_label,
      revision_code = excluded.revision_code,
      input_summary = excluded.input_summary,
      status = excluded.status,
      lifecycle_status = excluded.lifecycle_status
    `,
  )

  db.transaction((records: WorkflowProjectRecord[]) => {
    records.forEach((project) => {
      upsertProject.run(
        project.id,
        project.name,
        project.module,
        project.createdAt,
        project.updatedAt,
        project.version,
        project.revisionCode,
        project.inputSummary ?? '',
        project.status,
        project.lifecycleStatus,
      )
    })
    deleteMissingByIds('workflow_project', 'project_id', records.map((item) => item.id))
  })(projects)

  const activeProjectId = getWorkflowState('active_project_id')
  if (activeProjectId && !projects.some((project) => project.id === activeProjectId)) {
    setWorkflowState('active_project_id', null)
  }

  return listWorkflowProjects()
}

export function getWorkflowState(key: string) {
  const row = getDatabase()
    .prepare('SELECT state_value FROM workflow_state WHERE state_key = ?')
    .get(key) as { state_value: string | null } | undefined
  return row?.state_value ?? null
}

export function setWorkflowState(key: string, value: string | null) {
  getDatabase()
    .prepare(
      `
      INSERT INTO workflow_state (state_key, state_value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(state_key) DO UPDATE SET
        state_value = excluded.state_value,
        updated_at = excluded.updated_at
      `,
    )
    .run(key, value)
  return value
}

export function listWorkflowReports(): WorkflowReportRecord[] {
  return getDatabase()
    .prepare(
      `
      SELECT
        report_id AS id,
        title,
        module_code AS module,
        created_at AS createdAt,
        report_type AS type,
        status,
        project_number AS projectNumber,
        project_id AS projectId,
        project_name AS projectName,
        standard_ref AS standardRef,
        author_name AS author,
        summary,
        source_kind AS sourceKind,
        linked_run_id AS linkedRunId,
        linked_result_id AS linkedResultId,
        revision_code AS revisionCode,
        workflow_status AS workflowStatus
      FROM report_artifact
      ORDER BY datetime(created_at) DESC
      `,
    )
    .all() as WorkflowReportRecord[]
}

export function replaceWorkflowReports(reports: WorkflowReportRecord[]) {
  const db = getDatabase()
  const upsertReport = db.prepare(
    `
    INSERT INTO report_artifact (
      report_id, title, module_code, created_at, report_type, status,
      project_number, project_id, project_name, standard_ref, author_name, summary, source_kind,
      linked_run_id, linked_result_id, workflow_status, content_json, revision_code
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    ON CONFLICT(report_id) DO UPDATE SET
      title = excluded.title,
      module_code = excluded.module_code,
      created_at = excluded.created_at,
      report_type = excluded.report_type,
      status = excluded.status,
      project_number = excluded.project_number,
      project_id = excluded.project_id,
      project_name = excluded.project_name,
      standard_ref = excluded.standard_ref,
      author_name = excluded.author_name,
      summary = excluded.summary,
      source_kind = excluded.source_kind,
      linked_run_id = excluded.linked_run_id,
      linked_result_id = excluded.linked_result_id,
      workflow_status = excluded.workflow_status,
      revision_code = excluded.revision_code
    `,
  )

  db.transaction((records: WorkflowReportRecord[]) => {
    records.forEach((report) => {
      const linkedProjectId = resolveExistingProjectId(report.projectId ?? null)
      upsertReport.run(
        report.id,
        report.title,
        report.module,
        report.createdAt,
        report.type,
        report.status,
        report.projectNumber ?? null,
        linkedProjectId,
        report.projectName ?? null,
        report.standardRef ?? null,
        report.author ?? null,
        report.summary ?? null,
        report.sourceKind ?? 'module-result',
        report.linkedRunId ?? null,
        report.linkedResultId ?? null,
        report.workflowStatus ?? (report.sourceKind === 'archive-report' ? 'approved' : 'draft'),
        report.revisionCode ?? 'A',
      )
    })
    deleteMissingByIds('report_artifact', 'report_id', records.map((item) => item.id))
  })(reports)

  return listWorkflowReports()
}

function hydrateBomDraftFromHeader(header: any): WorkflowBomDraft | null {
  if (!header) return null
  const items = getDatabase()
    .prepare(
      `
      SELECT
        item_id AS id,
        category_code AS category,
        designation,
        description,
        quantity,
        standard_ref AS standard,
        material_code AS material,
        supplier_name AS supplier,
        supplier_part_no AS supplierPartNo,
        unit_cost AS unitCost,
        total_cost AS totalCost
      FROM bom_item
      WHERE bom_id = ?
      ORDER BY line_no
      `,
    )
    .all(header.bom_id) as WorkflowBomItem[]

  return {
    bomId: header.bom_id,
    projectId: header.project_id ?? undefined,
    projectName: header.project_name,
    projectNumber: header.project_number,
    author: header.author_name ?? undefined,
    date: header.report_date ?? undefined,
    revision: header.revision_code ?? 'A',
    summary: header.summary ?? undefined,
    status: header.status ?? 'draft',
    sourceKind: header.source_kind ?? 'manual',
    items,
  }
}

export function listBomDrafts(limit = 100): WorkflowBomDraft[] {
  const headers = getDatabase()
    .prepare(
      `
      SELECT *
      FROM bom_header
      ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
      LIMIT ?
      `,
    )
    .all(limit) as any[]

  return headers
    .map((header) => hydrateBomDraftFromHeader(header))
    .filter((draft): draft is WorkflowBomDraft => Boolean(draft))
}

export function getLatestBomDraft(projectId?: string | null): WorkflowBomDraft | null {
  const header = (
    projectId
      ? getDatabase()
          .prepare(
            `
            SELECT * FROM bom_header
            WHERE project_id = ?
            ORDER BY datetime(updated_at) DESC
            LIMIT 1
            `,
          )
          .get(projectId)
      : getDatabase()
          .prepare(
            `
            SELECT * FROM bom_header
            ORDER BY datetime(updated_at) DESC
            LIMIT 1
            `,
          )
          .get()
  ) as any

  return hydrateBomDraftFromHeader(header)
}

export function saveBomDraft(draft: WorkflowBomDraft) {
  const db = getDatabase()
  const bomId = draft.bomId ?? `bom_${Date.now()}`
  const now = new Date().toISOString()
  const linkedProjectId = resolveExistingProjectId(draft.projectId ?? null)
  const normalizedItems = draft.items.map((item, index) => ({
    ...item,
    id: item.id || `${bomId}_item_${index + 1}`,
    quantity: Number(item.quantity || 1),
    unitCost: Number(item.unitCost || 0),
    totalCost: Number(item.totalCost || Number(item.quantity || 1) * Number(item.unitCost || 0)),
  }))

  const itemCount = normalizedItems.length
  const totalCost = normalizedItems.reduce((sum, item) => sum + Number(item.totalCost || 0), 0)
  const existing = db.prepare('SELECT created_at FROM bom_header WHERE bom_id = ?').get(bomId) as { created_at?: string } | undefined
  const createdAt = existing?.created_at ?? now

  const upsertHeader = db.prepare(
    `
    INSERT INTO bom_header (
      bom_id, project_id, project_number, project_name, author_name, revision_code, status, source_kind,
      total_cost, item_count, report_date, summary, created_at, updated_at, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(bom_id) DO UPDATE SET
      project_id = excluded.project_id,
      project_number = excluded.project_number,
      project_name = excluded.project_name,
      author_name = excluded.author_name,
      revision_code = excluded.revision_code,
      status = excluded.status,
      source_kind = excluded.source_kind,
      total_cost = excluded.total_cost,
      item_count = excluded.item_count,
      report_date = excluded.report_date,
      summary = excluded.summary,
      updated_at = excluded.updated_at,
      payload_json = excluded.payload_json
    `,
  )

  const deleteItems = db.prepare('DELETE FROM bom_item WHERE bom_id = ?')
  const insertItem = db.prepare(
    `
    INSERT INTO bom_item (
      item_id, bom_id, line_no, category_code, designation, description, quantity,
      standard_ref, material_code, supplier_name, supplier_part_no, unit_cost, total_cost, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  )

  db.transaction(() => {
    upsertHeader.run(
      bomId,
      linkedProjectId,
      draft.projectNumber,
      draft.projectName,
      draft.author ?? null,
      draft.revision ?? 'A',
      draft.status ?? 'draft',
      draft.sourceKind ?? 'manual',
      totalCost,
      itemCount,
      draft.date ?? null,
      draft.summary ?? null,
      createdAt,
      now,
      JSON.stringify({
        projectName: draft.projectName,
        projectNumber: draft.projectNumber,
        author: draft.author ?? null,
        date: draft.date ?? null,
        revision: draft.revision ?? 'A',
      }),
    )

    deleteItems.run(bomId)

    normalizedItems.forEach((item, index) => {
      insertItem.run(
        item.id,
        bomId,
        index + 1,
        item.category,
        item.designation,
        item.description,
        item.quantity,
        item.standard ?? null,
        item.material ?? null,
        item.supplier ?? null,
        item.supplierPartNo ?? null,
        item.unitCost,
        item.totalCost,
        JSON.stringify(item),
      )
    })
  })()

  syncBomDerivedObjects({
    bomId,
    projectId: linkedProjectId,
    revisionCode: draft.revision ?? 'A',
    sourceKind: draft.sourceKind ?? 'manual',
    items: normalizedItems,
    createdAt,
    updatedAt: now,
  })

  appendObjectEventLogInternal({
    id: `evt_bom_${bomId}_${Date.now()}`,
    objectType: 'bom',
    objectId: bomId,
    projectId: linkedProjectId ?? undefined,
    module: 'bom-export',
    eventType: draft.bomId ? 'updated' : 'created',
    summary: draft.bomId
      ? `更新 BOM 草稿，共 ${itemCount} 条物料，总成本 ¥${totalCost.toFixed(2)}`
      : `创建 BOM 草稿，共 ${itemCount} 条物料，总成本 ¥${totalCost.toFixed(2)}`,
    actorName: draft.author ?? '系统',
    eventAt: now,
    payload: {
      revisionCode: draft.revision ?? 'A',
      status: draft.status ?? 'draft',
      sourceKind: draft.sourceKind ?? 'manual',
      itemCount,
      totalCost,
    },
  })

  return getLatestBomDraft(draft.projectId ?? null) ?? { ...draft, bomId }
}

export function listCalculationRuns(limit = 20): WorkflowCalculationRunRecord[] {
  return getDatabase()
    .prepare(
      `
      SELECT
        run_id AS id,
        module_code AS module,
        run_name AS name,
        created_at AS createdAt,
        project_id AS projectId,
        project_number AS projectNumber,
        project_name AS projectName,
        source_kind AS sourceKind,
        summary,
        linked_report_id AS linkedReportId,
        input_json AS inputJson,
        output_json AS outputJson,
        metadata_json AS metadataJson
      FROM calculation_run
      ORDER BY datetime(created_at) DESC
      LIMIT ?
      `,
    )
    .all(limit)
    .map((row: any) => normalizeCalculationRunRow(row))
    .filter((row): row is WorkflowCalculationRunRecord => Boolean(row))
}

export function appendCalculationRun(record: WorkflowCalculationRunRecord) {
  const db = getDatabase()
  const linkedProjectId = resolveExistingProjectId(record.projectId ?? null)
  const linkedReportId = resolveExistingReportId(record.linkedReportId ?? null)
  db.prepare(
    `
    INSERT INTO calculation_run (
      run_id, module_code, run_name, created_at, project_id, project_number, project_name,
      source_kind, summary, linked_report_id, input_json, output_json, metadata_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET
      module_code = excluded.module_code,
      run_name = excluded.run_name,
      created_at = excluded.created_at,
      project_id = excluded.project_id,
      project_number = excluded.project_number,
      project_name = excluded.project_name,
      source_kind = excluded.source_kind,
      summary = excluded.summary,
      linked_report_id = excluded.linked_report_id,
      input_json = excluded.input_json,
      output_json = excluded.output_json,
      metadata_json = excluded.metadata_json
    `,
  ).run(
    record.id,
    record.module,
    record.name,
    record.createdAt,
    linkedProjectId,
    record.projectNumber ?? null,
    record.projectName ?? null,
    record.sourceKind,
    record.summary ?? null,
    linkedReportId,
    record.inputData === undefined ? null : JSON.stringify(record.inputData),
    record.outputData === undefined ? null : JSON.stringify(record.outputData),
    record.metadata == null ? null : JSON.stringify(record.metadata),
  )

  const row = getDatabase()
    .prepare(
      `
      SELECT
        run_id AS id,
        module_code AS module,
        run_name AS name,
        created_at AS createdAt,
        project_id AS projectId,
        project_number AS projectNumber,
        project_name AS projectName,
        source_kind AS sourceKind,
        summary,
        linked_report_id AS linkedReportId,
        input_json AS inputJson,
        output_json AS outputJson,
        metadata_json AS metadataJson
      FROM calculation_run
      WHERE run_id = ?
      `,
    )
    .get(record.id) as any

  return normalizeCalculationRunRow(row)
}

export function replaceCalculationRuns(records: WorkflowCalculationRunRecord[]) {
  const db = getDatabase()
  if (!records.length) {
    return listCalculationRuns(20)
  }

  db.transaction((items: WorkflowCalculationRunRecord[]) => {
    items.forEach((item) => {
      appendCalculationRun(item)
    })
    const ids = items.map((item) => item.id)
    const sourceKinds = Array.from(new Set(items.map((item) => item.sourceKind)))
    const idPlaceholders = ids.map(() => '?').join(', ')
    const sourcePlaceholders = sourceKinds.map(() => '?').join(', ')
    db.prepare(
      `
      DELETE FROM calculation_run
      WHERE source_kind IN (${sourcePlaceholders})
        AND run_id NOT IN (${idPlaceholders})
      `,
    ).run(...sourceKinds, ...ids)
  })(records)

  return listCalculationRuns(Math.max(records.length, 20))
}

export function listScenarioSnapshots(limit = 100, runId?: string | null): WorkflowScenarioSnapshotRecord[] {
  const db = getDatabase()
  const query = runId
    ? db.prepare(
        `
        SELECT
          snapshot_id AS id,
          run_id AS runId,
          module_code AS module,
          snapshot_kind AS snapshotKind,
          title,
          summary,
          input_json AS inputJson,
          context_json AS contextJson,
          created_at AS createdAt
        FROM scenario_snapshot
        WHERE run_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        `,
      )
    : db.prepare(
        `
        SELECT
          snapshot_id AS id,
          run_id AS runId,
          module_code AS module,
          snapshot_kind AS snapshotKind,
          title,
          summary,
          input_json AS inputJson,
          context_json AS contextJson,
          created_at AS createdAt
        FROM scenario_snapshot
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        `,
      )

  const rows = (runId ? query.all(runId, limit) : query.all(limit)) as any[]
  return rows
    .map((row) => normalizeScenarioSnapshotRow(row))
    .filter((row): row is WorkflowScenarioSnapshotRecord => Boolean(row))
}

function appendScenarioSnapshot(record: WorkflowScenarioSnapshotRecord) {
  const db = getDatabase()
  db.prepare(
    `
    INSERT INTO scenario_snapshot (
      snapshot_id, run_id, module_code, snapshot_kind, title, summary, input_json, context_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id, snapshot_kind) DO UPDATE SET
      snapshot_id = excluded.snapshot_id,
      module_code = excluded.module_code,
      title = excluded.title,
      summary = excluded.summary,
      input_json = excluded.input_json,
      context_json = excluded.context_json,
      created_at = excluded.created_at
    `,
  ).run(
    record.id,
    record.runId,
    record.module,
    record.snapshotKind,
    record.title ?? null,
    record.summary ?? null,
    record.inputData === undefined ? null : JSON.stringify(record.inputData),
    record.contextData === undefined ? null : JSON.stringify(record.contextData),
    record.createdAt,
  )
}

export function listCalculationResults(limit = 100, runId?: string | null): WorkflowCalculationResultRecord[] {
  const db = getDatabase()
  const query = runId
    ? db.prepare(
        `
        SELECT
          result_id AS id,
          run_id AS runId,
          module_code AS module,
          result_kind AS resultKind,
          status,
          summary,
          output_json AS outputJson,
          derived_metrics_json AS derivedMetricsJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM calculation_result
        WHERE run_id = ?
        ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
        LIMIT ?
        `,
      )
    : db.prepare(
        `
        SELECT
          result_id AS id,
          run_id AS runId,
          module_code AS module,
          result_kind AS resultKind,
          status,
          summary,
          output_json AS outputJson,
          derived_metrics_json AS derivedMetricsJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM calculation_result
        ORDER BY datetime(updated_at) DESC, datetime(created_at) DESC
        LIMIT ?
        `,
      )

  const rows = (runId ? query.all(runId, limit) : query.all(limit)) as any[]
  return rows
    .map((row) => normalizeCalculationResultRow(row))
    .filter((row): row is WorkflowCalculationResultRecord => Boolean(row))
}

function appendCalculationResult(record: WorkflowCalculationResultRecord) {
  const db = getDatabase()
  db.prepare(
    `
    INSERT INTO calculation_result (
      result_id, run_id, module_code, result_kind, status, summary,
      output_json, derived_metrics_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(run_id, result_kind) DO UPDATE SET
      result_id = excluded.result_id,
      module_code = excluded.module_code,
      status = excluded.status,
      summary = excluded.summary,
      output_json = excluded.output_json,
      derived_metrics_json = excluded.derived_metrics_json,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
    `,
  ).run(
    record.id,
    record.runId,
    record.module,
    record.resultKind,
    record.status,
    record.summary ?? null,
    record.outputData === undefined ? null : JSON.stringify(record.outputData),
    record.derivedMetrics == null ? null : JSON.stringify(record.derivedMetrics),
    record.createdAt,
    record.updatedAt,
  )
}

export function recordCalculationArtifacts(bundle: WorkflowArtifactBundleRecord) {
  const db = getDatabase()
  db.transaction((payload: WorkflowArtifactBundleRecord) => {
    appendCalculationRun(payload.run)
    for (const snapshot of payload.snapshots ?? []) {
      appendScenarioSnapshot(snapshot)
    }
    for (const result of payload.results ?? []) {
      appendCalculationResult(result)
    }
  })(bundle)

  const primaryResult = bundle.results?.[0]
  appendObjectEventLogInternal({
    id: `evt_run_${bundle.run.id}_${Date.now()}`,
    objectType: 'run',
    objectId: bundle.run.id,
    projectId: bundle.run.projectId,
    module: bundle.run.module,
    eventType: 'calculated',
    summary: `记录 ${bundle.run.name} 的正式运行对象`,
    actorName: '系统',
    eventAt: bundle.run.createdAt,
    payload: {
      sourceKind: bundle.run.sourceKind,
      linkedReportId: bundle.run.linkedReportId ?? null,
      snapshotCount: bundle.snapshots?.length ?? 0,
      resultCount: bundle.results?.length ?? 0,
    },
  })

  if (primaryResult) {
    appendObjectEventLogInternal({
      id: `evt_result_${primaryResult.id}_${Date.now()}`,
      objectType: 'result',
      objectId: primaryResult.id,
      projectId: bundle.run.projectId,
      module: primaryResult.module,
      eventType: 'linked',
      summary: `沉淀 ${primaryResult.resultKind} 结果对象，状态 ${primaryResult.status}`,
      actorName: '系统',
      eventAt: primaryResult.updatedAt,
      payload: {
        runId: primaryResult.runId,
        resultKind: primaryResult.resultKind,
        status: primaryResult.status,
      },
    })
  }

  return {
    run: appendCalculationRun(bundle.run),
    snapshots: listScenarioSnapshots(20, bundle.run.id),
    results: listCalculationResults(20, bundle.run.id),
  }
}

export function listChangeCases(limit = 100, projectId?: string | null): WorkflowChangeCaseRecord[] {
  const db = getDatabase()
  const query = projectId
    ? db.prepare(
        `
        SELECT
          change_id AS id,
          project_id AS projectId,
          object_type AS objectType,
          object_id AS objectId,
          change_code AS changeCode,
          title,
          module_code AS module,
          change_reason AS reason,
          impact_summary AS impactSummary,
          requested_by AS requestedBy,
          requested_at AS requestedAt,
          effective_at AS effectiveAt,
          status,
          revision_code AS revisionCode,
          payload_json AS payloadJson
        FROM change_case
        WHERE project_id = ?
        ORDER BY datetime(requested_at) DESC
        LIMIT ?
        `,
      )
    : db.prepare(
        `
        SELECT
          change_id AS id,
          project_id AS projectId,
          object_type AS objectType,
          object_id AS objectId,
          change_code AS changeCode,
          title,
          module_code AS module,
          change_reason AS reason,
          impact_summary AS impactSummary,
          requested_by AS requestedBy,
          requested_at AS requestedAt,
          effective_at AS effectiveAt,
          status,
          revision_code AS revisionCode,
          payload_json AS payloadJson
        FROM change_case
        ORDER BY datetime(requested_at) DESC
        LIMIT ?
        `,
      )

  const rows = (projectId ? query.all(projectId, limit) : query.all(limit)) as any[]
  return rows
    .map((row) => normalizeChangeCaseRow(row))
    .filter((row): row is WorkflowChangeCaseRecord => Boolean(row))
}

export function upsertChangeCase(record: WorkflowChangeCaseRecord) {
  const db = getDatabase()
  const linkedProjectId = resolveExistingProjectId(record.projectId ?? null)
  db.prepare(
    `
    INSERT INTO change_case (
      change_id, project_id, object_type, object_id, change_code, title, module_code, change_reason,
      impact_summary, requested_by, requested_at, effective_at, status, revision_code, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(change_id) DO UPDATE SET
      project_id = excluded.project_id,
      object_type = excluded.object_type,
      object_id = excluded.object_id,
      change_code = excluded.change_code,
      title = excluded.title,
      module_code = excluded.module_code,
      change_reason = excluded.change_reason,
      impact_summary = excluded.impact_summary,
      requested_by = excluded.requested_by,
      requested_at = excluded.requested_at,
      effective_at = excluded.effective_at,
      status = excluded.status,
      revision_code = excluded.revision_code,
      payload_json = excluded.payload_json
    `,
  ).run(
    record.id,
    linkedProjectId,
    record.objectType,
    record.objectId,
    record.changeCode ?? null,
    record.title,
    record.module ?? null,
    record.reason ?? null,
    record.impactSummary ?? null,
    record.requestedBy ?? null,
    record.requestedAt,
    record.effectiveAt ?? null,
    record.status,
    record.revisionCode ?? 'A',
    record.payload == null ? null : JSON.stringify(record.payload),
  )

  const row = db
    .prepare(
      `
      SELECT
        change_id AS id,
        project_id AS projectId,
        object_type AS objectType,
        object_id AS objectId,
        change_code AS changeCode,
        title,
        module_code AS module,
        change_reason AS reason,
        impact_summary AS impactSummary,
        requested_by AS requestedBy,
        requested_at AS requestedAt,
        effective_at AS effectiveAt,
        status,
        revision_code AS revisionCode,
        payload_json AS payloadJson
      FROM change_case
      WHERE change_id = ?
      `,
    )
    .get(record.id) as any

  return normalizeChangeCaseRow(row)
}

export function listApprovalTasks(
  limit = 120,
  objectType?: WorkflowChangeObjectType | null,
  objectId?: string | null,
): WorkflowApprovalTaskRecord[] {
  const db = getDatabase()
  let rows: any[] = []

  if (objectType && objectId) {
    rows = db
      .prepare(
        `
        SELECT
          approval_id AS id,
          change_id AS changeId,
          project_id AS projectId,
          object_type AS objectType,
          object_id AS objectId,
          module_code AS module,
          task_title AS title,
          approval_role AS approvalRole,
          assignee_name AS assigneeName,
          decision_status AS decisionStatus,
          due_at AS dueAt,
          decided_at AS decidedAt,
          comment,
          seq_no AS seqNo,
          created_at AS createdAt,
          updated_at AS updatedAt,
          payload_json AS payloadJson
        FROM approval_task
        WHERE object_type = ? AND object_id = ?
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        `,
      )
      .all(objectType, objectId, limit) as any[]
  } else {
    rows = db
      .prepare(
        `
        SELECT
          approval_id AS id,
          change_id AS changeId,
          project_id AS projectId,
          object_type AS objectType,
          object_id AS objectId,
          module_code AS module,
          task_title AS title,
          approval_role AS approvalRole,
          assignee_name AS assigneeName,
          decision_status AS decisionStatus,
          due_at AS dueAt,
          decided_at AS decidedAt,
          comment,
          seq_no AS seqNo,
          created_at AS createdAt,
          updated_at AS updatedAt,
          payload_json AS payloadJson
        FROM approval_task
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        `,
      )
      .all(limit) as any[]
  }

  return rows
    .map((row) => normalizeApprovalTaskRow(row))
    .filter((row): row is WorkflowApprovalTaskRecord => Boolean(row))
}

export function upsertApprovalTask(record: WorkflowApprovalTaskRecord) {
  const db = getDatabase()
  const linkedProjectId = resolveExistingProjectId(record.projectId ?? null)
  db.prepare(
    `
    INSERT INTO approval_task (
      approval_id, change_id, project_id, object_type, object_id, module_code, task_title, approval_role,
      assignee_name, decision_status, due_at, decided_at, comment, seq_no, created_at, updated_at, payload_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(approval_id) DO UPDATE SET
      change_id = excluded.change_id,
      project_id = excluded.project_id,
      object_type = excluded.object_type,
      object_id = excluded.object_id,
      module_code = excluded.module_code,
      task_title = excluded.task_title,
      approval_role = excluded.approval_role,
      assignee_name = excluded.assignee_name,
      decision_status = excluded.decision_status,
      due_at = excluded.due_at,
      decided_at = excluded.decided_at,
      comment = excluded.comment,
      seq_no = excluded.seq_no,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      payload_json = excluded.payload_json
    `,
  ).run(
    record.id,
    record.changeId ?? null,
    linkedProjectId,
    record.objectType,
    record.objectId,
    record.module ?? null,
    record.title,
    record.approvalRole ?? null,
    record.assigneeName ?? null,
    record.decisionStatus,
    record.dueAt ?? null,
    record.decidedAt ?? null,
    record.comment ?? null,
    record.seqNo ?? 1,
    record.createdAt,
    record.updatedAt,
    record.payload == null ? null : JSON.stringify(record.payload),
  )

  const row = db
    .prepare(
      `
      SELECT
        approval_id AS id,
        change_id AS changeId,
        project_id AS projectId,
        object_type AS objectType,
        object_id AS objectId,
        module_code AS module,
        task_title AS title,
        approval_role AS approvalRole,
        assignee_name AS assigneeName,
        decision_status AS decisionStatus,
        due_at AS dueAt,
        decided_at AS decidedAt,
        comment,
        seq_no AS seqNo,
        created_at AS createdAt,
        updated_at AS updatedAt,
        payload_json AS payloadJson
      FROM approval_task
      WHERE approval_id = ?
      `,
    )
    .get(record.id) as any

  return normalizeApprovalTaskRow(row)
}

export function listObjectEventLogs(
  limit = 160,
  objectType?: WorkflowChangeObjectType | null,
  objectId?: string | null,
  projectId?: string | null,
): WorkflowObjectEventLogRecord[] {
  const db = getDatabase()
  let rows: any[] = []

  if (objectType && objectId) {
    rows = db
      .prepare(
        `
        SELECT
          event_id AS id,
          object_type AS objectType,
          object_id AS objectId,
          project_id AS projectId,
          module_code AS module,
          event_type AS eventType,
          event_summary AS summary,
          actor_name AS actorName,
          event_at AS eventAt,
          payload_json AS payloadJson
        FROM object_event_log
        WHERE object_type = ? AND object_id = ?
        ORDER BY datetime(event_at) DESC
        LIMIT ?
        `,
      )
      .all(objectType, objectId, limit) as any[]
  } else if (projectId) {
    rows = db
      .prepare(
        `
        SELECT
          event_id AS id,
          object_type AS objectType,
          object_id AS objectId,
          project_id AS projectId,
          module_code AS module,
          event_type AS eventType,
          event_summary AS summary,
          actor_name AS actorName,
          event_at AS eventAt,
          payload_json AS payloadJson
        FROM object_event_log
        WHERE project_id = ?
        ORDER BY datetime(event_at) DESC
        LIMIT ?
        `,
      )
      .all(projectId, limit) as any[]
  } else {
    rows = db
      .prepare(
        `
        SELECT
          event_id AS id,
          object_type AS objectType,
          object_id AS objectId,
          project_id AS projectId,
          module_code AS module,
          event_type AS eventType,
          event_summary AS summary,
          actor_name AS actorName,
          event_at AS eventAt,
          payload_json AS payloadJson
        FROM object_event_log
        ORDER BY datetime(event_at) DESC
        LIMIT ?
        `,
      )
      .all(limit) as any[]
  }

  return rows
    .map((row) => normalizeObjectEventLogRow(row))
    .filter((row): row is WorkflowObjectEventLogRecord => Boolean(row))
}

export function appendObjectEventLog(record: WorkflowObjectEventLogRecord) {
  appendObjectEventLogInternal(record)
  const row = getDatabase()
    .prepare(
      `
      SELECT
        event_id AS id,
        object_type AS objectType,
        object_id AS objectId,
        project_id AS projectId,
        module_code AS module,
        event_type AS eventType,
        event_summary AS summary,
        actor_name AS actorName,
        event_at AS eventAt,
        payload_json AS payloadJson
      FROM object_event_log
      WHERE event_id = ?
      `,
    )
    .get(record.id) as any

  return normalizeObjectEventLogRow(row)
}

export function listPartMasters(limit = 200, projectId?: string | null): WorkflowPartMasterRecord[] {
  const db = getDatabase()
  const query = projectId
    ? db.prepare(
        `
        SELECT
          part_id AS id,
          project_id AS projectId,
          part_number AS partNumber,
          part_name AS partName,
          category_code AS category,
          standard_ref AS standardRef,
          material_code AS materialCode,
          preferred_supplier_name AS preferredSupplierName,
          latest_supplier_part_no AS latestSupplierPartNo,
          revision_code AS revisionCode,
          lifecycle_status AS lifecycleStatus,
          source_kind AS sourceKind,
          created_at AS createdAt,
          updated_at AS updatedAt,
          metadata_json AS metadataJson
        FROM part_master
        WHERE project_id = ?
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        `,
      )
    : db.prepare(
        `
        SELECT
          part_id AS id,
          project_id AS projectId,
          part_number AS partNumber,
          part_name AS partName,
          category_code AS category,
          standard_ref AS standardRef,
          material_code AS materialCode,
          preferred_supplier_name AS preferredSupplierName,
          latest_supplier_part_no AS latestSupplierPartNo,
          revision_code AS revisionCode,
          lifecycle_status AS lifecycleStatus,
          source_kind AS sourceKind,
          created_at AS createdAt,
          updated_at AS updatedAt,
          metadata_json AS metadataJson
        FROM part_master
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        `,
      )

  const rows = (projectId ? query.all(projectId, limit) : query.all(limit)) as any[]
  return rows
    .map((row) => normalizePartMasterRow(row))
    .filter((row): row is WorkflowPartMasterRecord => Boolean(row))
}

export function upsertPartMaster(record: WorkflowPartMasterRecord) {
  upsertPartMasterInternal(record)
  appendObjectEventLogInternal({
    id: `evt_part_${record.id}_${Date.now()}`,
    objectType: 'part',
    objectId: record.id,
    projectId: record.projectId,
    module: 'bom-export',
    eventType: 'updated',
    summary: `同步零件主数据 ${record.partNumber}`,
    actorName: '系统',
    eventAt: record.updatedAt,
    payload: {
      category: record.category,
      revisionCode: record.revisionCode ?? 'A',
      sourceKind: record.sourceKind ?? 'derived-bom',
    },
  })
  const row = getDatabase()
    .prepare(
      `
      SELECT
        part_id AS id,
        project_id AS projectId,
        part_number AS partNumber,
        part_name AS partName,
        category_code AS category,
        standard_ref AS standardRef,
        material_code AS materialCode,
        preferred_supplier_name AS preferredSupplierName,
        latest_supplier_part_no AS latestSupplierPartNo,
        revision_code AS revisionCode,
        lifecycle_status AS lifecycleStatus,
        source_kind AS sourceKind,
        created_at AS createdAt,
        updated_at AS updatedAt,
        metadata_json AS metadataJson
      FROM part_master
      WHERE part_id = ?
      `,
    )
    .get(record.id) as any

  return normalizePartMasterRow(row)
}

export function listSupplierParts(limit = 240, partId?: string | null): WorkflowSupplierPartRecord[] {
  const db = getDatabase()
  const query = partId
    ? db.prepare(
        `
        SELECT
          supplier_part_id AS id,
          part_id AS partId,
          supplier_name AS supplierName,
          supplier_part_no AS supplierPartNo,
          manufacturer_name AS manufacturerName,
          unit_cost AS unitCost,
          currency_code AS currencyCode,
          moq,
          lead_time_days AS leadTimeDays,
          preferred_flag AS preferredFlag,
          created_at AS createdAt,
          updated_at AS updatedAt,
          metadata_json AS metadataJson
        FROM supplier_part
        WHERE part_id = ?
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        `,
      )
    : db.prepare(
        `
        SELECT
          supplier_part_id AS id,
          part_id AS partId,
          supplier_name AS supplierName,
          supplier_part_no AS supplierPartNo,
          manufacturer_name AS manufacturerName,
          unit_cost AS unitCost,
          currency_code AS currencyCode,
          moq,
          lead_time_days AS leadTimeDays,
          preferred_flag AS preferredFlag,
          created_at AS createdAt,
          updated_at AS updatedAt,
          metadata_json AS metadataJson
        FROM supplier_part
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        `,
      )

  const rows = (partId ? query.all(partId, limit) : query.all(limit)) as any[]
  return rows
    .map((row) => normalizeSupplierPartRow(row))
    .filter((row): row is WorkflowSupplierPartRecord => Boolean(row))
}

export function upsertSupplierPart(record: WorkflowSupplierPartRecord) {
  upsertSupplierPartInternal(record)
  const row = getDatabase()
    .prepare(
      `
      SELECT
        supplier_part_id AS id,
        part_id AS partId,
        supplier_name AS supplierName,
        supplier_part_no AS supplierPartNo,
        manufacturer_name AS manufacturerName,
        unit_cost AS unitCost,
        currency_code AS currencyCode,
        moq,
        lead_time_days AS leadTimeDays,
        preferred_flag AS preferredFlag,
        created_at AS createdAt,
        updated_at AS updatedAt,
        metadata_json AS metadataJson
      FROM supplier_part
      WHERE supplier_part_id = ?
      `,
    )
    .get(record.id) as any

  return normalizeSupplierPartRow(row)
}

export function listBomRevisionLinks(limit = 240, bomId?: string | null): WorkflowBomRevisionLinkRecord[] {
  const db = getDatabase()
  const query = bomId
    ? db.prepare(
        `
        SELECT
          link_id AS id,
          bom_id AS bomId,
          part_id AS partId,
          revision_code AS revisionCode,
          line_no AS lineNo,
          quantity,
          source_item_id AS sourceItemId,
          created_at AS createdAt,
          updated_at AS updatedAt,
          metadata_json AS metadataJson
        FROM bom_revision_link
        WHERE bom_id = ?
        ORDER BY line_no ASC
        LIMIT ?
        `,
      )
    : db.prepare(
        `
        SELECT
          link_id AS id,
          bom_id AS bomId,
          part_id AS partId,
          revision_code AS revisionCode,
          line_no AS lineNo,
          quantity,
          source_item_id AS sourceItemId,
          created_at AS createdAt,
          updated_at AS updatedAt,
          metadata_json AS metadataJson
        FROM bom_revision_link
        ORDER BY datetime(updated_at) DESC
        LIMIT ?
        `,
      )

  const rows = (bomId ? query.all(bomId, limit) : query.all(limit)) as any[]
  return rows
    .map((row) => normalizeBomRevisionLinkRow(row))
    .filter((row): row is WorkflowBomRevisionLinkRecord => Boolean(row))
}

export function listDocumentAttachments(
  limit = 240,
  objectType?: WorkflowChangeObjectType | null,
  objectId?: string | null,
  projectId?: string | null,
): WorkflowDocumentAttachmentRecord[] {
  const db = getDatabase()
  let rows: any[] = []

  if (objectType && objectId) {
    rows = db
      .prepare(
        `
        SELECT
          document_id AS id,
          project_id AS projectId,
          object_type AS objectType,
          object_id AS objectId,
          module_code AS module,
          document_kind AS documentKind,
          title,
          file_name AS fileName,
          mime_type AS mimeType,
          storage_type AS storageType,
          revision_code AS revisionCode,
          created_at AS createdAt,
          created_by AS createdBy,
          status,
          checksum,
          payload_json AS payloadJson
        FROM document_attachment
        WHERE object_type = ? AND object_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        `,
      )
      .all(objectType, objectId, limit) as any[]
  } else if (projectId) {
    rows = db
      .prepare(
        `
        SELECT
          document_id AS id,
          project_id AS projectId,
          object_type AS objectType,
          object_id AS objectId,
          module_code AS module,
          document_kind AS documentKind,
          title,
          file_name AS fileName,
          mime_type AS mimeType,
          storage_type AS storageType,
          revision_code AS revisionCode,
          created_at AS createdAt,
          created_by AS createdBy,
          status,
          checksum,
          payload_json AS payloadJson
        FROM document_attachment
        WHERE project_id = ?
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        `,
      )
      .all(projectId, limit) as any[]
  } else {
    rows = db
      .prepare(
        `
        SELECT
          document_id AS id,
          project_id AS projectId,
          object_type AS objectType,
          object_id AS objectId,
          module_code AS module,
          document_kind AS documentKind,
          title,
          file_name AS fileName,
          mime_type AS mimeType,
          storage_type AS storageType,
          revision_code AS revisionCode,
          created_at AS createdAt,
          created_by AS createdBy,
          status,
          checksum,
          payload_json AS payloadJson
        FROM document_attachment
        ORDER BY datetime(created_at) DESC
        LIMIT ?
        `,
      )
      .all(limit) as any[]
  }

  return rows
    .map((row) => normalizeDocumentAttachmentRow(row))
    .filter((row): row is WorkflowDocumentAttachmentRecord => Boolean(row))
}

export function upsertDocumentAttachment(record: WorkflowDocumentAttachmentRecord) {
  appendDocumentAttachmentInternal(record)
  appendObjectEventLogInternal({
    id: `evt_document_${record.id}_${Date.now()}`,
    objectType: 'document',
    objectId: record.id,
    projectId: record.projectId,
    module: record.module,
    eventType: 'linked',
    summary: `登记文档附件 ${record.title}`,
    actorName: record.createdBy ?? '系统',
    eventAt: record.createdAt,
    payload: {
      documentKind: record.documentKind,
      fileName: record.fileName ?? null,
      objectType: record.objectType,
      objectId: record.objectId,
    },
  })
  const row = getDatabase()
    .prepare(
      `
      SELECT
        document_id AS id,
        project_id AS projectId,
        object_type AS objectType,
        object_id AS objectId,
        module_code AS module,
        document_kind AS documentKind,
        title,
        file_name AS fileName,
        mime_type AS mimeType,
        storage_type AS storageType,
        revision_code AS revisionCode,
        created_at AS createdAt,
        created_by AS createdBy,
        status,
        checksum,
        payload_json AS payloadJson
      FROM document_attachment
      WHERE document_id = ?
      `,
    )
    .get(record.id) as any

  return normalizeDocumentAttachmentRow(row)
}
