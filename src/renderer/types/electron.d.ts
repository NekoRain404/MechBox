export {};

declare global {
  interface WorkflowProjectRecord {
    id: string;
    name: string;
    module: string;
    createdAt: string;
    updatedAt: string;
    version: string;
    revisionCode: string;
    inputSummary: string;
    status: "active" | "archived";
    lifecycleStatus: "draft" | "in-review" | "approved" | "released" | "archived";
  }

  interface WorkflowReportRecord {
    id: string;
    title: string;
    module: string;
    createdAt: string;
    type: "pdf" | "csv" | "json";
    status: "generated" | "pending";
    projectNumber?: string;
    projectId?: string;
    projectName?: string;
    standardRef?: string;
    author?: string;
    summary?: string;
    sourceKind?: "module-result" | "analysis-export" | "archive-report" | "manual-report";
    linkedRunId?: string;
    linkedResultId?: string;
    revisionCode?: string;
    workflowStatus?: "draft" | "in-review" | "approved" | "released" | "archived";
  }

  interface WorkflowBomItemRecord {
    id: string;
    category: string;
    designation: string;
    description: string;
    quantity: number;
    standard?: string;
    material?: string;
    supplier?: string;
    supplierPartNo?: string;
    unitCost?: number;
    totalCost?: number;
  }

  interface WorkflowBomDraftRecord {
    bomId?: string;
    projectId?: string;
    projectName: string;
    projectNumber: string;
    author?: string;
    date?: string;
    revision?: string;
    summary?: string;
    status?: "draft" | "in-review" | "approved" | "released" | "archived";
    sourceKind?: "manual" | "derived" | "imported";
    items: WorkflowBomItemRecord[];
  }

  interface WorkflowCalculationRunRecord {
    id: string;
    module: string;
    name: string;
    createdAt: string;
    projectId?: string;
    projectNumber?: string;
    projectName?: string;
    sourceKind: "recent-calculation" | "pdf-export" | "analysis-export" | "archive-report" | "manual-report";
    summary?: string;
    linkedReportId?: string;
    inputData?: unknown;
    outputData?: unknown;
    metadata?: Record<string, unknown> | null;
  }

  interface WorkflowScenarioSnapshotRecord {
    id: string;
    runId: string;
    module: string;
    snapshotKind: "input" | "context" | "decision";
    title?: string;
    summary?: string;
    inputData?: unknown;
    contextData?: unknown;
    createdAt: string;
  }

  interface WorkflowCalculationResultRecord {
    id: string;
    runId: string;
    module: string;
    resultKind: "primary" | "summary" | "distribution" | "recommendation" | "comparison" | "analysis";
    status: "computed" | "warning" | "error" | "archived";
    summary?: string;
    outputData?: unknown;
    derivedMetrics?: Record<string, unknown> | null;
    createdAt: string;
    updatedAt: string;
  }

  interface WorkflowArtifactBundleRecord {
    run: WorkflowCalculationRunRecord;
    snapshots?: WorkflowScenarioSnapshotRecord[];
    results?: WorkflowCalculationResultRecord[];
  }

  interface WorkflowPartMasterRecord {
    id: string;
    projectId?: string;
    partNumber: string;
    partName: string;
    category: string;
    standardRef?: string;
    materialCode?: string;
    preferredSupplierName?: string;
    latestSupplierPartNo?: string;
    revisionCode?: string;
    lifecycleStatus?: "draft" | "in-review" | "approved" | "released" | "archived";
    sourceKind?: "derived-bom" | "manual" | "imported";
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | null;
  }

  interface WorkflowSupplierPartRecord {
    id: string;
    partId: string;
    supplierName: string;
    supplierPartNo: string;
    manufacturerName?: string;
    unitCost?: number;
    currencyCode?: string;
    moq?: number;
    leadTimeDays?: number;
    preferredFlag?: boolean;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | null;
  }

  interface WorkflowBomRevisionLinkRecord {
    id: string;
    bomId: string;
    partId: string;
    revisionCode?: string;
    lineNo: number;
    quantity: number;
    sourceItemId?: string;
    createdAt: string;
    updatedAt: string;
    metadata?: Record<string, unknown> | null;
  }

  interface WorkflowDocumentAttachmentRecord {
    id: string;
    projectId?: string;
    objectType: "project" | "report" | "bom" | "run" | "result" | "part" | "document";
    objectId: string;
    module?: string;
    documentKind: "pdf" | "csv" | "json" | "image" | "note" | "package" | "snapshot" | "spec";
    title: string;
    fileName?: string;
    mimeType?: string;
    storageType?: "embedded" | "export-reference" | "local-path";
    revisionCode?: string;
    createdAt: string;
    createdBy?: string;
    status?: "draft" | "generated" | "released" | "archived";
    checksum?: string;
    payload?: Record<string, unknown> | null;
  }

  type WorkflowChangeObjectType = "project" | "report" | "bom" | "run" | "result" | "part" | "document";

  interface WorkflowChangeCaseRecord {
    id: string;
    projectId?: string;
    objectType: WorkflowChangeObjectType;
    objectId: string;
    changeCode?: string;
    title: string;
    module?: string;
    reason?: string;
    impactSummary?: string;
    requestedBy?: string;
    requestedAt: string;
    effectiveAt?: string;
    status: "draft" | "in-review" | "approved" | "released" | "rejected" | "archived";
    revisionCode?: string;
    payload?: Record<string, unknown> | null;
  }

  interface WorkflowApprovalTaskRecord {
    id: string;
    changeId?: string;
    projectId?: string;
    objectType: WorkflowChangeObjectType;
    objectId: string;
    module?: string;
    title: string;
    approvalRole?: string;
    assigneeName?: string;
    decisionStatus: "pending" | "approved" | "rejected" | "waived";
    dueAt?: string;
    decidedAt?: string;
    comment?: string;
    seqNo?: number;
    createdAt: string;
    updatedAt: string;
    payload?: Record<string, unknown> | null;
  }

  interface WorkflowObjectEventLogRecord {
    id: string;
    objectType: WorkflowChangeObjectType;
    objectId: string;
    projectId?: string;
    module?: string;
    eventType:
      | "created"
      | "updated"
      | "opened"
      | "status-changed"
      | "approval-requested"
      | "approval-decided"
      | "exported"
      | "imported"
      | "deleted"
      | "archived"
      | "restored"
      | "calculated"
      | "linked";
    summary: string;
    actorName?: string;
    eventAt: string;
    payload?: Record<string, unknown> | null;
  }

  interface OringRecommendationInput {
    standard?: string;
    dashCode?: string;
    crossSection?: number;
    application?: "radial-outer" | "radial-inner" | "axial";
    isStatic?: boolean;
    medium?: string;
    temperatureC?: number;
    pressureMpa?: number;
    pressurePsi?: number;
    hardness?: number;
    clearanceMm?: number;
    glandDiameterMm?: number;
    grooveDepthMm?: number;
    grooveWidthMm?: number;
    candidateLimit?: number;
  }

  interface Window {
    electron: {
      db: {
        // Business Tables
        queryBearings: () => Promise<any[]>;
        queryThreads: () => Promise<any[]>;
        queryBolts: () => Promise<any[]>;
        queryNuts: () => Promise<any[]>;
        queryWashers: () => Promise<any[]>;
        queryOringList: (standard?: string) => Promise<any[]>;
        queryOringSpec: (standard: string, code: string) => Promise<any>;
        queryOringMaterials: () => Promise<any[]>;
        queryOringRecommendation: (input: OringRecommendationInput) => Promise<any>;
        queryMaterials: () => Promise<any[]>;
        queryMaterialEquivalents: (materialId?: string) => Promise<any[]>;
        queryGearModules: () => Promise<any[]>;
        queryManufacturers: () => Promise<any[]>;
        queryVendorParts: (domainCode?: string) => Promise<any[]>;
        globalSearch: (query: string, limit?: number) => Promise<any[]>;
        
        // Governance Tables
        querySources: () => Promise<any[]>;
        queryStandardSystems: () => Promise<any[]>;
        queryDatasets: () => Promise<any[]>;
        queryRules: (ruleCode?: string) => Promise<any>;
        queryDataVersion: () => Promise<Array<{
          standard_code: string;
          version: string;
          source: string;
          updated_at: string;
          checksum: string;
        }>>;
        
        // User Data
        addUserStandard: (id: string, category: string, data: any) => Promise<any>;
        queryUserStandards: (category: string) => Promise<any[]>;
        deleteUserStandard: (id: string) => Promise<any>;
        getUserStandard: (id: string) => Promise<any | null>;
        
        // Tools
        reverseIdentify: (type: string, measurements: Record<string, number>) => Promise<any[]>;
        importExcel: (templateType: string) => Promise<any>;
        downloadTemplate: (templateType: string, savePath: string) => Promise<boolean>;
      };
      workflow: {
        listProjects: () => Promise<WorkflowProjectRecord[]>;
        replaceProjects: (projects: WorkflowProjectRecord[]) => Promise<WorkflowProjectRecord[]>;
        getActiveProjectId: () => Promise<string | null>;
        setActiveProjectId: (projectId?: string | null) => Promise<string | null>;
        listReports: () => Promise<WorkflowReportRecord[]>;
        replaceReports: (reports: WorkflowReportRecord[]) => Promise<WorkflowReportRecord[]>;
        saveBomDraft: (draft: WorkflowBomDraftRecord) => Promise<WorkflowBomDraftRecord>;
        listBomDrafts: (limit?: number) => Promise<WorkflowBomDraftRecord[]>;
        getLatestBomDraft: (projectId?: string | null) => Promise<WorkflowBomDraftRecord | null>;
        listCalculationRuns: (limit?: number) => Promise<WorkflowCalculationRunRecord[]>;
        replaceCalculationRuns: (records: WorkflowCalculationRunRecord[]) => Promise<WorkflowCalculationRunRecord[]>;
        appendCalculationRun: (record: WorkflowCalculationRunRecord) => Promise<WorkflowCalculationRunRecord | null>;
        listScenarioSnapshots: (limit?: number, runId?: string | null) => Promise<WorkflowScenarioSnapshotRecord[]>;
        listCalculationResults: (limit?: number, runId?: string | null) => Promise<WorkflowCalculationResultRecord[]>;
        recordCalculationArtifacts: (bundle: WorkflowArtifactBundleRecord) => Promise<{
          run: WorkflowCalculationRunRecord | null;
          snapshots: WorkflowScenarioSnapshotRecord[];
          results: WorkflowCalculationResultRecord[];
        }>;
        listChangeCases: (limit?: number, projectId?: string | null) => Promise<WorkflowChangeCaseRecord[]>;
        upsertChangeCase: (record: WorkflowChangeCaseRecord) => Promise<WorkflowChangeCaseRecord | null>;
        listApprovalTasks: (limit?: number, objectType?: WorkflowChangeObjectType | null, objectId?: string | null) => Promise<WorkflowApprovalTaskRecord[]>;
        upsertApprovalTask: (record: WorkflowApprovalTaskRecord) => Promise<WorkflowApprovalTaskRecord | null>;
        listObjectEventLogs: (
          limit?: number,
          objectType?: WorkflowChangeObjectType | null,
          objectId?: string | null,
          projectId?: string | null,
        ) => Promise<WorkflowObjectEventLogRecord[]>;
        appendObjectEventLog: (record: WorkflowObjectEventLogRecord) => Promise<WorkflowObjectEventLogRecord | null>;
        listPartMasters: (limit?: number, projectId?: string | null) => Promise<WorkflowPartMasterRecord[]>;
        upsertPartMaster: (record: WorkflowPartMasterRecord) => Promise<WorkflowPartMasterRecord | null>;
        listSupplierParts: (limit?: number, partId?: string | null) => Promise<WorkflowSupplierPartRecord[]>;
        upsertSupplierPart: (record: WorkflowSupplierPartRecord) => Promise<WorkflowSupplierPartRecord | null>;
        listBomRevisionLinks: (limit?: number, bomId?: string | null) => Promise<WorkflowBomRevisionLinkRecord[]>;
        listDocumentAttachments: (
          limit?: number,
          objectType?: WorkflowChangeObjectType | null,
          objectId?: string | null,
          projectId?: string | null,
        ) => Promise<WorkflowDocumentAttachmentRecord[]>;
        upsertDocumentAttachment: (record: WorkflowDocumentAttachmentRecord) => Promise<WorkflowDocumentAttachmentRecord | null>;
      };
    };
  }
}
