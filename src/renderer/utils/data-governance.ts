import { getElectronDb } from "./electron-db";

export interface RouteGovernanceRefs {
  sourceIds?: string[];
  datasetIds?: string[];
  versionCodes?: string[];
}

export interface SourceProviderRecord {
  source_id: string;
  source_name: string;
  source_type: "public_open" | "purchased_standard" | "vendor_catalog" | "reference_db" | "enterprise";
  homepage_url?: string | null;
  license_note?: string | null;
  trust_level?: number | null;
  notes?: string | null;
  created_at?: string | null;
}

export interface DatasetReleaseRecord {
  dataset_id: string;
  dataset_name: string;
  dataset_version: string;
  source_id?: string | null;
  revision_id?: string | null;
  imported_at?: string | null;
  checksum?: string | null;
  row_count?: number | null;
  notes?: string | null;
}

export interface DataVersionRecord {
  standard_code: string;
  version: string;
  source?: string | null;
  updated_at?: string | null;
  checksum?: string | null;
}

export interface GovernanceSnapshot {
  mode: "sqlite" | "fallback";
  sources: SourceProviderRecord[];
  datasets: DatasetReleaseRecord[];
  versions: DataVersionRecord[];
}

const fallbackSources: SourceProviderRecord[] = [
  {
    source_id: "samr_openstd",
    source_name: "国家标准全文公开系统",
    source_type: "public_open",
    homepage_url: "https://openstd.samr.gov.cn/bzgk/std/index",
    license_note: "公开可获取 GB/GB/T 数据",
    trust_level: 5,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "sae_mobilus",
    source_name: "SAE Mobilus",
    source_type: "purchased_standard",
    homepage_url: "https://saemobilus.sae.org/",
    license_note: "适合 AS568F 等正式标准",
    trust_level: 5,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "iso",
    source_name: "ISO Standards",
    source_type: "purchased_standard",
    homepage_url: "https://www.iso.org/",
    license_note: "正式标准",
    trust_level: 5,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "apple_rubber",
    source_name: "Apple Rubber",
    source_type: "vendor_catalog",
    homepage_url: "https://www.applerubber.com/",
    license_note: "公开 O-Ring 材料资料",
    trust_level: 4,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "gmors_catalog",
    source_name: "GMORS Catalog",
    source_type: "vendor_catalog",
    homepage_url: "https://www.gmors.com/",
    license_note: "公开 O-Ring 标准尺寸 PDF",
    trust_level: 4,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "marco_sealing",
    source_name: "Marco Sealing Solutions",
    source_type: "vendor_catalog",
    homepage_url: "https://www.marcorubber.com/",
    license_note: "公开网页资料",
    trust_level: 4,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "nsk_catalog",
    source_name: "NSK Catalogs and CAD",
    source_type: "vendor_catalog",
    homepage_url: "https://www.nsk.com/catalogs-and-cad/",
    license_note: "公开目录与 CAD 资料",
    trust_level: 4,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "ferrobend_iso",
    source_name: "FERROBEND ISO Fasteners",
    source_type: "reference_db",
    homepage_url: "https://iso-fasteners.com/",
    license_note: "公开 ISO 紧固件资料",
    trust_level: 3,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "boltport",
    source_name: "Boltport Fasteners",
    source_type: "reference_db",
    homepage_url: "https://boltport.com/standards/",
    license_note: "公开紧固件标准资料",
    trust_level: 3,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "khk_gear_world",
    source_name: "KHK Gear World",
    source_type: "vendor_catalog",
    homepage_url: "https://www.khkgears.us/",
    license_note: "公开齿轮商品目录",
    trust_level: 4,
    created_at: "2026-04-12 14:39:31",
  },
  {
    source_id: "mechbox_internal",
    source_name: "MechBox Internal Models",
    source_type: "enterprise",
    homepage_url: "https://github.com/",
    license_note: "仓库内置规则、公式与方法学配置",
    trust_level: 4,
    created_at: "2026-04-12 14:39:31",
  },
];

const fallbackDatasets: DatasetReleaseRecord[] = [
  {
    dataset_id: "dataset_materials_extended_json",
    dataset_name: "Materials Extended JSON",
    dataset_version: "1.0.0",
    source_id: "samr_openstd",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置 JSON",
  },
  {
    dataset_id: "dataset_threads_iso_metric_json",
    dataset_name: "ISO Metric Threads JSON",
    dataset_version: "1.0.0",
    source_id: "iso",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置 JSON",
  },
  {
    dataset_id: "dataset_bolts_hex_json",
    dataset_name: "Hex Bolts JSON",
    dataset_version: "1.0.0",
    source_id: "iso",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置 JSON",
  },
  {
    dataset_id: "dataset_iso_4032_ferrobend",
    dataset_name: "ISO 4032 FERROBEND",
    dataset_version: "2026-04-12",
    source_id: "ferrobend_iso",
    imported_at: "2026-04-12 14:39:31",
    row_count: 48,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_iso_4034_ferrobend",
    dataset_name: "ISO 4034 FERROBEND",
    dataset_version: "2026-04-12",
    source_id: "ferrobend_iso",
    imported_at: "2026-04-12 14:39:31",
    row_count: 23,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_iso_4035_boltport",
    dataset_name: "ISO 4035 BOLTPORT",
    dataset_version: "2026-04-12",
    source_id: "boltport",
    imported_at: "2026-04-12 14:39:31",
    row_count: 29,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_iso_7089_ferrobend",
    dataset_name: "ISO 7089 FERROBEND",
    dataset_version: "2026-04-12",
    source_id: "ferrobend_iso",
    imported_at: "2026-04-12 14:39:31",
    row_count: 42,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_iso_7090_ferrobend",
    dataset_name: "ISO 7090 FERROBEND",
    dataset_version: "2026-04-12",
    source_id: "ferrobend_iso",
    imported_at: "2026-04-12 14:39:31",
    row_count: 33,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_iso_7091_ferrobend",
    dataset_name: "ISO 7091 FERROBEND",
    dataset_version: "2026-04-12",
    source_id: "ferrobend_iso",
    imported_at: "2026-04-12 14:39:31",
    row_count: 29,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_iso_7092_boltport",
    dataset_name: "ISO 7092 BOLTPORT",
    dataset_version: "2026-04-12",
    source_id: "boltport",
    imported_at: "2026-04-12 14:39:31",
    row_count: 27,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_iso_7093_ferrobend",
    dataset_name: "ISO 7093 FERROBEND",
    dataset_version: "2026-04-12",
    source_id: "ferrobend_iso",
    imported_at: "2026-04-12 14:39:31",
    row_count: 19,
    notes: "公开网页抽取",
  },
  {
    dataset_id: "dataset_bearings_deep_groove_json",
    dataset_name: "Deep Groove Bearings JSON",
    dataset_version: "1.0.0",
    source_id: "nsk_catalog",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置 JSON",
  },
  {
    dataset_id: "dataset_nsk_deep_groove_pdf",
    dataset_name: "NSK Deep Groove Catalog PDF",
    dataset_version: "2026-04-12",
    source_id: "nsk_catalog",
    imported_at: "2026-04-12 14:39:31",
    row_count: 54,
    notes: "公开 PDF 抽取",
  },
  {
    dataset_id: "dataset_oring_as568_json",
    dataset_name: "AS568 O-Ring JSON",
    dataset_version: "1.0.0",
    source_id: "sae_mobilus",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置 JSON",
  },
  {
    dataset_id: "dataset_oring_material_apple",
    dataset_name: "O-Ring Material Apple",
    dataset_version: "2026-04-12",
    source_id: "apple_rubber",
    imported_at: "2026-04-12 14:39:31",
    row_count: 8,
    notes: "公开网页整理",
  },
  {
    dataset_id: "dataset_oring_compat_apple",
    dataset_name: "O-Ring Chemical Compatibility Apple",
    dataset_version: "2026-04-12",
    source_id: "apple_rubber",
    imported_at: "2026-04-12 14:39:31",
    row_count: 15,
    notes: "公开网页整理",
  },
  {
    dataset_id: "dataset_oring_rules_gmors",
    dataset_name: "O-Ring Groove Rules GMORS",
    dataset_version: "2026-04-12",
    source_id: "gmors_catalog",
    imported_at: "2026-04-12 14:39:31",
    row_count: 22,
    notes: "公开 PDF 整理",
  },
  {
    dataset_id: "dataset_oring_rules_marco",
    dataset_name: "O-Ring Design Rules Marco",
    dataset_version: "2026-04-12",
    source_id: "marco_sealing",
    imported_at: "2026-04-12 14:39:31",
    row_count: 9,
    notes: "公开网页整理",
  },
  {
    dataset_id: "dataset_jis_b2401_gmors_pdf",
    dataset_name: "JIS B 2401 GMORS PDF",
    dataset_version: "2026-04-12",
    source_id: "gmors_catalog",
    imported_at: "2026-04-12 14:39:31",
    row_count: 419,
    notes: "公开 PDF 抽取",
  },
  {
    dataset_id: "dataset_khk_vendor_seed",
    dataset_name: "KHK Vendor Catalog Seed",
    dataset_version: "2026-04-12",
    source_id: "khk_gear_world",
    imported_at: "2026-04-12 14:39:31",
    row_count: 14,
    notes: "公开商品页面抓取",
  },
  {
    dataset_id: "dataset_iso286_local_table",
    dataset_name: "ISO 286 Local Table",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置公差表",
  },
  {
    dataset_id: "dataset_units_builtin_constants",
    dataset_name: "Units Builtin Constants",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置换算常数",
  },
  {
    dataset_id: "dataset_param_scan_internal_model",
    dataset_name: "Param Scan Internal Model",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置参数扫描模型",
  },
  {
    dataset_id: "dataset_monte_carlo_internal_model",
    dataset_name: "Monte Carlo Internal Model",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置蒙特卡洛与统计规则",
  },
  {
    dataset_id: "dataset_dfm_internal_rules",
    dataset_name: "DFM Internal Rules",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置公差-工艺-成本映射规则",
  },
  {
    dataset_id: "dataset_failure_rule_tree",
    dataset_name: "Failure Diagnosis Rule Tree",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置症状-原因规则树",
  },
  {
    dataset_id: "dataset_structured_import_templates",
    dataset_name: "Structured Import Templates",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置 CSV 模板字段与示例",
  },
  {
    dataset_id: "dataset_report_templates",
    dataset_name: "Report Templates",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置报告模板与归档文本结构",
  },
  {
    dataset_id: "dataset_bom_internal_rules",
    dataset_name: "BOM Internal Rules",
    dataset_version: "1.0.0",
    source_id: "mechbox_internal",
    imported_at: "2026-04-12 14:39:31",
    notes: "仓库内置 BOM 汇总与导出规则",
  },
];

const fallbackVersions: DataVersionRecord[] = [
  {
    standard_code: "ORING_MATERIAL_APPLE",
    version: "2026-04-12",
    source: "apple_rubber",
    updated_at: "2026-04-12 14:42:03",
    checksum: "rows:8",
  },
  {
    standard_code: "ORING_COMPAT_APPLE",
    version: "2026-04-12",
    source: "apple_rubber",
    updated_at: "2026-04-12 14:42:03",
    checksum: "rows:15",
  },
  {
    standard_code: "ORING_GLAND_GMORS",
    version: "2026-04-12",
    source: "gmors_catalog",
    updated_at: "2026-04-12 14:42:03",
    checksum: "rows:22",
  },
  {
    standard_code: "ORING_RULES_MARCO",
    version: "2026-04-12",
    source: "marco_sealing",
    updated_at: "2026-04-12 14:42:03",
    checksum: "rows:9",
  },
  {
    standard_code: "NSK_PUBLIC_PDF",
    version: "2026-04-12",
    source: "nsk_catalog",
    updated_at: "2026-04-12 14:42:03",
    checksum: "rows:54",
  },
  {
    standard_code: "FERROBEND_FASTENER",
    version: "2026-04-12",
    source: "ferrobend_iso",
    updated_at: "2026-04-12 14:42:03",
    checksum: "iso4032+4034+7089+7090+7091+7093+boltport4035+boltport7092",
  },
  {
    standard_code: "KHK_VENDOR",
    version: "2026-04-12",
    source: "khk_gear_world",
    updated_at: "2026-04-12 14:42:03",
    checksum: "urls:17",
  },
  {
    standard_code: "ISO286_LOCAL_TABLE",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:iso286",
  },
  {
    standard_code: "UNITS_BUILTIN_CONSTANTS",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:unit-converter",
  },
  {
    standard_code: "PARAM_SCAN_INTERNAL",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:param-scan",
  },
  {
    standard_code: "MONTE_CARLO_INTERNAL",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:monte-carlo",
  },
  {
    standard_code: "DFM_RULESET_V1",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:dfm-cost",
  },
  {
    standard_code: "FAILURE_RULE_TREE_V1",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:failure-diagnosis",
  },
  {
    standard_code: "CSV_TEMPLATE_V1",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:structured-import",
  },
  {
    standard_code: "REPORT_TEMPLATE_V1",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:reporting",
  },
  {
    standard_code: "BOM_RULESET_V1",
    version: "2026-04-12",
    source: "mechbox_internal",
    updated_at: "2026-04-12 14:42:03",
    checksum: "repo:bom-export",
  },
];

let governanceSnapshotPromise: Promise<GovernanceSnapshot> | null = null;

function mergeByKey<T extends Record<string, any>>(primary: T[], fallback: T[], key: keyof T) {
  const map = new Map<string, T>();
  for (const record of fallback) {
    map.set(String(record[key]), record);
  }
  for (const record of primary) {
    map.set(String(record[key]), {
      ...map.get(String(record[key])),
      ...record,
    });
  }
  return Array.from(map.values());
}

function uniqueIds(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

function pickByIds<T extends Record<string, any>>(records: T[], ids: string[] | undefined, key: keyof T) {
  if (!ids?.length) {
    return [];
  }
  const recordMap = new Map(records.map((record) => [String(record[key]), record]));
  return ids
    .map((id) => recordMap.get(id))
    .filter((record): record is T => Boolean(record));
}

export async function getGovernanceSnapshot() {
  if (governanceSnapshotPromise) {
    return governanceSnapshotPromise;
  }

  const db = getElectronDb();
  if (!db) {
    return {
      mode: "fallback" as const,
      sources: fallbackSources,
      datasets: fallbackDatasets,
      versions: fallbackVersions,
    };
  }

  governanceSnapshotPromise = Promise.all([
    db.querySources(),
    db.queryDatasets(),
    db.queryDataVersion(),
  ])
    .then(([sources, datasets, versions]) => ({
      mode: "sqlite" as const,
      sources: mergeByKey(sources ?? [], fallbackSources, "source_id"),
      datasets: mergeByKey(datasets ?? [], fallbackDatasets, "dataset_id"),
      versions: mergeByKey(versions ?? [], fallbackVersions, "standard_code"),
    }))
    .catch(() => ({
      mode: "fallback" as const,
      sources: fallbackSources,
      datasets: fallbackDatasets,
      versions: fallbackVersions,
    }));

  return governanceSnapshotPromise;
}

export function resolveGovernanceRefs(refs: RouteGovernanceRefs | undefined, snapshot: GovernanceSnapshot) {
  const datasets = pickByIds(snapshot.datasets, refs?.datasetIds, "dataset_id");
  const versions = pickByIds(snapshot.versions, refs?.versionCodes, "standard_code");
  const sources = pickByIds(
    snapshot.sources,
    uniqueIds([
      ...(refs?.sourceIds ?? []),
      ...datasets.map((dataset) => dataset.source_id),
      ...versions.map((version) => version.source),
    ]),
    "source_id",
  );

  return {
    mode: snapshot.mode,
    sources,
    datasets,
    versions,
  };
}

export function formatGovernanceSourceType(sourceType?: string | null) {
  switch (sourceType) {
    case "public_open":
      return "公开标准";
    case "purchased_standard":
      return "正式标准";
    case "vendor_catalog":
      return "厂商目录";
    case "reference_db":
      return "参考数据库";
    case "enterprise":
      return "企业源";
    default:
      return "未标注";
  }
}

export function formatGovernanceTrustLevel(level?: number | null) {
  if (level == null) {
    return "信任等级未标注";
  }
  return `信任 ${level}/5`;
}

export function getGovernanceTrustColor(level?: number | null) {
  if ((level ?? 0) >= 5) return "green";
  if ((level ?? 0) >= 4) return "blue";
  if ((level ?? 0) >= 3) return "orange";
  return "default";
}

export function formatGovernanceRows(rowCount?: number | null) {
  if (rowCount == null) {
    return "仓库内置";
  }
  return `${rowCount} 条`;
}

export function formatGovernanceTime(value?: string | null) {
  if (!value) {
    return "时间未标注";
  }
  return value.replace("T", " ").slice(0, 16);
}
