import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  db: {
    // === Business Tables (V3 Schema) ===
    
    // Bearings
    queryBearings: () => ipcRenderer.invoke("db-query-bearings"),
    
    // Threads
    queryThreads: () => ipcRenderer.invoke("db-query-threads"),
    
    // Fasteners
    queryBolts: () => ipcRenderer.invoke("db-query-bolts"),
    queryNuts: () => ipcRenderer.invoke("db-query-nuts"),
    queryWashers: () => ipcRenderer.invoke("db-query-washers"),
    
    // O-rings
    queryOringList: (standard?: string) =>
      ipcRenderer.invoke("db-query-oring-list", standard),
    queryOringSpec: (standard: string, code: string) =>
      ipcRenderer.invoke("db-query-oring-spec", standard, code),
    queryOringMaterials: () => ipcRenderer.invoke("db-query-oring-materials"),
    queryOringRecommendation: (input: {
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
    }) => ipcRenderer.invoke("db-query-oring-recommendation", input),
    
    // Materials
    queryMaterials: () => ipcRenderer.invoke("db-query-materials"),
    queryMaterialEquivalents: (materialId?: string) =>
      ipcRenderer.invoke("db-query-material-equivalents", materialId),
    
    // Gears
    queryGearModules: () => ipcRenderer.invoke("db-query-gear-modules"),
    
    // Manufacturers & Vendor Parts
    queryManufacturers: () => ipcRenderer.invoke("db-query-manufacturers"),
    queryVendorParts: (domainCode?: string) =>
      ipcRenderer.invoke("db-query-vendor-parts", domainCode),
    
    // Global Search (FTS5)
    globalSearch: (query: string, limit?: number) =>
      ipcRenderer.invoke("db-global-search", query, limit),
    
    // === Governance Tables (V3 Schema) ===
    querySources: () => ipcRenderer.invoke("db-query-sources"),
    queryStandardSystems: () => ipcRenderer.invoke("db-query-standard-systems"),
    queryDatasets: () => ipcRenderer.invoke("db-query-datasets"),
    queryRules: (ruleCode?: string) => ipcRenderer.invoke("db-query-rules", ruleCode),
    
    // Data version
    queryDataVersion: () => ipcRenderer.invoke("db-query-data-version"),
    
    // === User Data ===
    addUserStandard: (id: string, category: string, data: any) =>
      ipcRenderer.invoke("db-user-standard-add", id, category, data),
    queryUserStandards: (category: string) =>
      ipcRenderer.invoke("db-user-standard-query", category),
    deleteUserStandard: (id: string) =>
      ipcRenderer.invoke("db-user-standard-delete", id),
    getUserStandard: (id: string) =>
      ipcRenderer.invoke("db-user-standard-get", id),
    
    // === Tools ===
    reverseIdentify: (type: string, measurements: Record<string, number>) =>
      ipcRenderer.invoke("db-reverse-identify", type, measurements),
    
    importExcel: (templateType: string) =>
      ipcRenderer.invoke("excel-import", templateType),
    downloadTemplate: (templateType: string, savePath: string) =>
      ipcRenderer.invoke("excel-download-template", templateType, savePath),
  },
  workflow: {
    listProjects: () => ipcRenderer.invoke("workflow-list-projects"),
    replaceProjects: (projects: any[]) => ipcRenderer.invoke("workflow-replace-projects", projects),
    getActiveProjectId: () => ipcRenderer.invoke("workflow-get-active-project-id"),
    setActiveProjectId: (projectId?: string | null) => ipcRenderer.invoke("workflow-set-active-project-id", projectId),
    listReports: () => ipcRenderer.invoke("workflow-list-reports"),
    replaceReports: (reports: any[]) => ipcRenderer.invoke("workflow-replace-reports", reports),
    saveBomDraft: (draft: any) => ipcRenderer.invoke("workflow-save-bom-draft", draft),
    listBomDrafts: (limit?: number) => ipcRenderer.invoke("workflow-list-bom-drafts", limit),
    getLatestBomDraft: (projectId?: string | null) => ipcRenderer.invoke("workflow-get-latest-bom-draft", projectId),
    listCalculationRuns: (limit?: number) => ipcRenderer.invoke("workflow-list-calculation-runs", limit),
    replaceCalculationRuns: (records: any[]) => ipcRenderer.invoke("workflow-replace-calculation-runs", records),
    appendCalculationRun: (record: any) => ipcRenderer.invoke("workflow-append-calculation-run", record),
    listScenarioSnapshots: (limit?: number, runId?: string | null) => ipcRenderer.invoke("workflow-list-scenario-snapshots", limit, runId),
    listCalculationResults: (limit?: number, runId?: string | null) => ipcRenderer.invoke("workflow-list-calculation-results", limit, runId),
    recordCalculationArtifacts: (bundle: any) => ipcRenderer.invoke("workflow-record-calculation-artifacts", bundle),
    listChangeCases: (limit?: number, projectId?: string | null) => ipcRenderer.invoke("workflow-list-change-cases", limit, projectId),
    upsertChangeCase: (record: any) => ipcRenderer.invoke("workflow-upsert-change-case", record),
    listApprovalTasks: (limit?: number, objectType?: string | null, objectId?: string | null) =>
      ipcRenderer.invoke("workflow-list-approval-tasks", limit, objectType, objectId),
    upsertApprovalTask: (record: any) => ipcRenderer.invoke("workflow-upsert-approval-task", record),
    listObjectEventLogs: (limit?: number, objectType?: string | null, objectId?: string | null, projectId?: string | null) =>
      ipcRenderer.invoke("workflow-list-object-event-logs", limit, objectType, objectId, projectId),
    appendObjectEventLog: (record: any) => ipcRenderer.invoke("workflow-append-object-event-log", record),
    listPartMasters: (limit?: number, projectId?: string | null) => ipcRenderer.invoke("workflow-list-part-masters", limit, projectId),
    upsertPartMaster: (record: any) => ipcRenderer.invoke("workflow-upsert-part-master", record),
    listSupplierParts: (limit?: number, partId?: string | null) => ipcRenderer.invoke("workflow-list-supplier-parts", limit, partId),
    upsertSupplierPart: (record: any) => ipcRenderer.invoke("workflow-upsert-supplier-part", record),
    listBomRevisionLinks: (limit?: number, bomId?: string | null) => ipcRenderer.invoke("workflow-list-bom-revision-links", limit, bomId),
    listDocumentAttachments: (limit?: number, objectType?: string | null, objectId?: string | null, projectId?: string | null) =>
      ipcRenderer.invoke("workflow-list-document-attachments", limit, objectType, objectId, projectId),
    upsertDocumentAttachment: (record: any) => ipcRenderer.invoke("workflow-upsert-document-attachment", record),
  },
});
