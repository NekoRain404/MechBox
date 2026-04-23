import type { RouteRecordRaw } from "vue-router";
import type { CapabilityLevel, VerificationLevel } from "./route-levels";
import type { RouteGovernanceRefs } from "@renderer/utils/data-governance";

type RouteComponent = NonNullable<RouteRecordRaw["component"]>;
type RouteComponentLoader = () => Promise<unknown>;

export interface AppRouteMeta {
    key: string;
    path: string;
    name: string;
    title: string;
    group: string;
    description: string;
    capabilityLevel?: CapabilityLevel;
    verificationLevel?: VerificationLevel;
    evidenceTags?: string[];
    evidenceSummary?: string;
    governanceRefs?: RouteGovernanceRefs;
    component: RouteComponent;
}

export const appRouteDefinitions: AppRouteMeta[] = [
    {
        key: "dashboard",
        path: "/",
        name: "Dashboard",
        title: "工具启动台",
        group: "工具",
        description: "按分类进入设计计算、资料检索与工程分析工具",
        component: () => import("../views/Dashboard.vue"),
    },
    {
        key: "tolerances",
        path: "/tolerances",
        name: "Tolerances",
        title: "公差配合",
        group: "基础设计与选型",
        description: "标准公差、基本偏差和配合结果查询",
        capabilityLevel: "engineering",
        verificationLevel: "regression",
        evidenceTags: ["ISO 286 本地标准表", "孔轴偏差规则", "极限间隙公式"],
        evidenceSummary: "孔轴基本偏差与 IT 等级来自本地标准表，配合结果按极限尺寸与间隙/过盈公式直接换算。",
        governanceRefs: {
            sourceIds: ["iso", "mechbox_internal"],
            datasetIds: ["dataset_iso286_local_table"],
            versionCodes: ["ISO286_LOCAL_TABLE"],
        },
        component: () => import("../views/tolerances/TolerancesPage.vue"),
    },
    {
        key: "tolerance-stack",
        path: "/tolerance-stack",
        name: "ToleranceStack",
        title: "公差堆叠分析",
        group: "基础设计与选型",
        description: "尺寸链、极限值和累积误差分析",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["尺寸链统计模型", "极限叠加规则", "筛查级近似"],
        evidenceSummary: "当前按尺寸链与统计叠加模型估算累积偏差，适合方案比较，不替代正式装配公差分析报告。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_monte_carlo_internal_model"],
            versionCodes: ["MONTE_CARLO_INTERNAL"],
        },
        component: () => import("../views/ToleranceStackPage.vue"),
    },
    {
        key: "seals",
        path: "/seals",
        name: "Seals",
        title: "密封圈",
        group: "基础设计与选型",
        description: "O 形圈选型、材质推荐和沟槽校核",
        capabilityLevel: "screening",
        verificationLevel: "regression",
        evidenceTags: ["AS568 本地尺寸表", "沟槽几何公式", "介质兼容规则"],
        evidenceSummary: "尺寸选取基于本地 O 形圈规格表，沟槽与压缩计算由显式几何规则完成，介质推荐来自本地规则链。",
        governanceRefs: {
            sourceIds: ["sae_mobilus", "apple_rubber", "gmors_catalog", "marco_sealing"],
            datasetIds: [
                "dataset_oring_as568_json",
                "dataset_oring_material_apple",
                "dataset_oring_compat_apple",
                "dataset_oring_rules_gmors",
                "dataset_oring_rules_marco",
                "dataset_jis_b2401_gmors_pdf",
            ],
            versionCodes: [
                "ORING_MATERIAL_APPLE",
                "ORING_COMPAT_APPLE",
                "ORING_GLAND_GMORS",
                "ORING_RULES_MARCO",
            ],
        },
        component: () => import("../views/seals/SealsPage.vue"),
    },
    {
        key: "bearings",
        path: "/bearings",
        name: "Bearings",
        title: "轴承选型",
        group: "基础设计与选型",
        description: "型号、寿命和工况计算",
        capabilityLevel: "screening",
        verificationLevel: "regression",
        evidenceTags: ["深沟球轴承本地数据集", "ISO 281 简化寿命", "润滑污染修正"],
        evidenceSummary: "型号参数来自本地轴承数据集，寿命计算按 ISO 281 基础公式与简化润滑污染修正进行筛查。",
        governanceRefs: {
            sourceIds: ["nsk_catalog"],
            datasetIds: ["dataset_bearings_deep_groove_json", "dataset_nsk_deep_groove_pdf"],
            versionCodes: ["NSK_PUBLIC_PDF"],
        },
        component: () => import("../views/bearings/BearingsPage.vue"),
    },
    {
        key: "bolts",
        path: "/bolts",
        name: "Bolts",
        title: "螺栓连接",
        group: "基础设计与选型",
        description: "预紧、强度和连接可靠性校核",
        capabilityLevel: "screening",
        verificationLevel: "regression",
        evidenceTags: ["螺栓规格本地数据", "扭矩法预紧", "VDI 2230 近似筛查"],
        evidenceSummary: "规格尺寸来自本地标准件数据，预紧力按扭矩法换算，连接安全性加入 VDI 2230 近似筛查链。",
        governanceRefs: {
            sourceIds: ["iso", "ferrobend_iso", "boltport"],
            datasetIds: [
                "dataset_bolts_hex_json",
                "dataset_iso_4032_ferrobend",
                "dataset_iso_4034_ferrobend",
                "dataset_iso_4035_boltport",
                "dataset_iso_7089_ferrobend",
                "dataset_iso_7090_ferrobend",
                "dataset_iso_7091_ferrobend",
                "dataset_iso_7092_boltport",
                "dataset_iso_7093_ferrobend",
            ],
            versionCodes: ["FERROBEND_FASTENER"],
        },
        component: () => import("../views/bolts/BoltsPage.vue"),
    },
    {
        key: "drives",
        path: "/drives",
        name: "Drives",
        title: "传动工具",
        group: "传动与动力系统",
        description: "带传动与链传动基础计算",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["基础传动公式", "经验系数", "筛查级近似"],
        evidenceSummary: "当前传动页主要基于基础功率、速比和经验系数计算，适合初筛，不代表完整传动系统校核。",
        component: () => import("../views/DrivesPage.vue"),
    },
    {
        key: "gears",
        path: "/gears",
        name: "Gears",
        title: "齿轮计算",
        group: "传动与动力系统",
        description: "齿轮参数、模数和几何关系",
        capabilityLevel: "screening",
        verificationLevel: "regression",
        evidenceTags: ["齿轮几何公式", "模数系列", "筛查级强度逻辑"],
        evidenceSummary: "当前以齿轮几何关系和模数系列为主，辅以基础强度逻辑，适合几何收敛与初步筛查。",
        component: () => import("../views/GearsPage.vue"),
    },
    {
        key: "springs",
        path: "/springs",
        name: "Springs",
        title: "弹簧计算",
        group: "传动与动力系统",
        description: "刚度、应力和失稳校核",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["弹簧基础公式", "应力修正", "筛查级失稳判断"],
        evidenceSummary: "当前结果基于基础弹簧公式和修正系数，适合方案比较，尚未形成完整样本对照与回归链。",
        component: () => import("../views/SpringsPage.vue"),
    },
    {
        key: "hydraulics",
        path: "/hydraulics",
        name: "Hydraulics",
        title: "液压气动",
        group: "传动与动力系统",
        description: "液压与气动的基础选型与计算",
        capabilityLevel: "screening",
        verificationLevel: "regression",
        evidenceTags: ["液压缸面积公式", "节拍换算", "欧拉稳定筛查"],
        evidenceSummary: "当前按理想压力、面积与节拍公式估算推力和速度，并用欧拉型稳定公式做受压杆筛查。",
        component: () => import("../views/HydraulicsPage.vue"),
    },
    {
        key: "motors",
        path: "/motors",
        name: "Motors",
        title: "电机选型",
        group: "传动与动力系统",
        description: "电机功率、转矩和匹配估算",
        capabilityLevel: "screening",
        verificationLevel: "regression",
        evidenceTags: ["转矩功率公式", "RMS 热负荷", "惯量比匹配"],
        evidenceSummary: "当前以连续/峰值/RMS 扭矩链估算电机功率，并用惯量比做快速匹配，适合筛查级选型。",
        component: () => import("../views/MotorsPage.vue"),
    },
    {
        key: "shafts",
        path: "/shafts",
        name: "Shafts",
        title: "轴强度校核",
        group: "传动与动力系统",
        description: "扭矩、弯矩和安全系数校核",
        capabilityLevel: "screening",
        verificationLevel: "regression",
        evidenceTags: ["轴强度基础公式", "弯扭合成", "安全系数规则"],
        evidenceSummary: "轴强度页基于弯矩、扭矩与等效应力公式进行快速校核，用于判断尺寸与载荷是否落入合理区间。",
        component: () => import("../views/ShaftsPage.vue"),
    },
    {
        key: "units",
        path: "/units",
        name: "Units",
        title: "单位换算",
        group: "工程资料与互换库",
        description: "工程单位快速换算与对照",
        capabilityLevel: "reference",
        verificationLevel: "unverified",
        evidenceTags: ["内置换算常数", "量纲对照"],
        evidenceSummary: "单位换算结果依赖内置换算常数与量纲映射，不涉及设计校核逻辑。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_units_builtin_constants"],
            versionCodes: ["UNITS_BUILTIN_CONSTANTS"],
        },
        component: () => import("../views/UnitConverterPage.vue"),
    },
    {
        key: "materials",
        path: "/materials",
        name: "Materials",
        title: "材料库",
        group: "工程资料与互换库",
        description: "材料牌号、性能和检索",
        capabilityLevel: "reference",
        verificationLevel: "unverified",
        evidenceTags: ["SQLite 材料表", "牌号检索", "性能字段映射"],
        evidenceSummary: "材料库主要提供材料牌号、性能字段与检索能力，适合资料查询，不应直接替代完整材料规范。",
        governanceRefs: {
            sourceIds: ["samr_openstd"],
            datasetIds: ["dataset_materials_extended_json"],
        },
        component: () => import("../views/MaterialLibraryPage.vue"),
    },
    {
        key: "standard-parts",
        path: "/standard-parts",
        name: "StandardParts",
        title: "标准件库",
        group: "工程资料与互换库",
        description: "标准件、厂商目录与结构化查询",
        capabilityLevel: "catalog",
        verificationLevel: "unverified",
        evidenceTags: ["SQLite 标准件表", "厂商目录表", "结构化检索"],
        evidenceSummary: "标准件库整合了本地标准表与厂商目录型数据，适合快速检索与目录收敛，不等同于正式标准全文。",
        governanceRefs: {
            sourceIds: ["iso", "ferrobend_iso", "boltport", "apple_rubber", "khk_gear_world"],
            datasetIds: [
                "dataset_threads_iso_metric_json",
                "dataset_iso_4032_ferrobend",
                "dataset_iso_4034_ferrobend",
                "dataset_iso_4035_boltport",
                "dataset_iso_7089_ferrobend",
                "dataset_iso_7090_ferrobend",
                "dataset_iso_7091_ferrobend",
                "dataset_iso_7092_boltport",
                "dataset_iso_7093_ferrobend",
                "dataset_oring_material_apple",
                "dataset_khk_vendor_seed",
            ],
            versionCodes: ["FERROBEND_FASTENER", "ORING_MATERIAL_APPLE", "KHK_VENDOR"],
        },
        component: () => import("../views/StandardPartsLibraryPage.vue"),
    },
    {
        key: "param-scan",
        path: "/param-scan",
        name: "ParamScan",
        title: "参数扫描研究",
        group: "高级分析与工程自动化",
        description: "设计窗口、参数敏感性与工况扫描研究",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["参数扫描算法", "敏感性分析", "筛查级可视化"],
        evidenceSummary: "当前输出反映模型在参数区间内的变化趋势，用于识别敏感区和危险区，不构成正式设计验证。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_param_scan_internal_model"],
            versionCodes: ["PARAM_SCAN_INTERNAL"],
        },
        component: () => import("../views/ParamScanPage.vue"),
    },
    {
        key: "monte-carlo",
        path: "/monte-carlo",
        name: "MonteCarlo",
        title: "随机模拟评估",
        group: "高级分析与工程自动化",
        description: "概率分布、离散性与良率评估",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["蒙特卡洛采样", "分布假设", "良率估算"],
        evidenceSummary: "蒙特卡洛页依赖输入分布假设与采样统计，适合研究离散性和趋势，不应被误读为现场实测结论。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_monte_carlo_internal_model"],
            versionCodes: ["MONTE_CARLO_INTERNAL"],
        },
        component: () => import("../views/MonteCarloPage.vue"),
    },
    {
        key: "dfm",
        path: "/dfm",
        name: "DFM",
        title: "制造性分析",
        group: "高级分析与工程自动化",
        description: "精度需求、工艺能力与成本权衡分析",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["工艺能力规则", "成本权衡模型", "筛查级建议"],
        evidenceSummary: "DFM 页当前用于比较精度、工艺能力和成本方向，属于工艺决策前的筛查与讨论工具。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_dfm_internal_rules"],
            versionCodes: ["DFM_RULESET_V1"],
        },
        component: () => import("../views/DFMAnalysisPage.vue"),
    },
    {
        key: "failure-diag",
        path: "/failure-diag",
        name: "FailureDiagnosis",
        title: "失效诊断",
        group: "高级分析与工程自动化",
        description: "基于症状的故障机理诊断与排查建议",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["症状规则树", "经验诊断链", "排查建议模板"],
        evidenceSummary: "失效诊断依赖规则树与经验症状映射，适合形成排查起点，不能替代拆检与实测证据。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_failure_rule_tree"],
            versionCodes: ["FAILURE_RULE_TREE_V1"],
        },
        component: () => import("../views/FailureDiagnosisPage.vue"),
    },
    {
        key: "reverse-identify",
        path: "/reverse-identify",
        name: "ReverseIdentify",
        title: "逆向识别",
        group: "工程资料与互换库",
        description: "按测量值反推标准规格",
        capabilityLevel: "screening",
        verificationLevel: "unverified",
        evidenceTags: ["反查规则", "规格近邻匹配", "筛查级识别"],
        evidenceSummary: "逆向识别按测量值与标准规格表做近邻匹配，适合缩小范围，仍需回到标准或目录复核。",
        governanceRefs: {
            sourceIds: ["iso", "nsk_catalog", "ferrobend_iso", "boltport"],
            datasetIds: [
                "dataset_threads_iso_metric_json",
                "dataset_bearings_deep_groove_json",
                "dataset_nsk_deep_groove_pdf",
                "dataset_bolts_hex_json",
                "dataset_iso_4032_ferrobend",
                "dataset_iso_4034_ferrobend",
                "dataset_iso_4035_boltport",
            ],
            versionCodes: ["NSK_PUBLIC_PDF", "FERROBEND_FASTENER"],
        },
        component: () => import("../views/ReverseIdentifyPage.vue"),
    },
    {
        key: "material-sub",
        path: "/material-sub",
        name: "MaterialSubstitution",
        title: "材料代换",
        group: "工程资料与互换库",
        description: "材料相近代换与风险提示",
        capabilityLevel: "reference",
        verificationLevel: "unverified",
        evidenceTags: ["材料性能字段", "体系映射表", "相近代换规则"],
        evidenceSummary: "材料代换主要比较力学性能、材料族和映射关系，属于资料筛查，不代表正式材料等效认证。",
        governanceRefs: {
            sourceIds: ["samr_openstd"],
            datasetIds: ["dataset_materials_extended_json"],
        },
        component: () => import("../views/MaterialSubstitutionPage.vue"),
    },
    {
        key: "excel-import",
        path: "/excel-import",
        name: "ExcelImport",
        title: "结构化导入",
        group: "高级分析与工程自动化",
        description: "模板校验、批量导入与结构化处理",
        capabilityLevel: "reference",
        verificationLevel: "unverified",
        evidenceTags: ["模板校验规则", "字段映射", "导入处理链"],
        evidenceSummary: "结构化导入页的主要依据是模板规则、字段校验与导入处理逻辑，不直接给出工程结论。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_structured_import_templates"],
            versionCodes: ["CSV_TEMPLATE_V1"],
        },
        component: () => import("../views/ExcelImportPage.vue"),
    },
    {
        key: "latex-report",
        path: "/latex-report",
        name: "LaTeXReport",
        title: "计算书编制",
        group: "高级分析与工程自动化",
        description: "结构化工程计算书与归档报告生成",
        capabilityLevel: "reference",
        verificationLevel: "unverified",
        evidenceTags: ["报告模板", "结构化字段", "归档导出"],
        evidenceSummary: "计算书编制页侧重整理已有结果并生成归档内容，报告内容质量仍取决于上游模块输入与复核。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_report_templates"],
            versionCodes: ["REPORT_TEMPLATE_V1"],
        },
        component: () => import("../views/LaTeXReportPage.vue"),
    },
    {
        key: "projects",
        path: "/projects",
        name: "Projects",
        title: "项目中心",
        group: "工作空间",
        description: "项目组织、草稿和模块串联",
        component: () => import("../views/ProjectCenterPage.vue"),
    },
    {
        key: "reports",
        path: "/reports",
        name: "Reports",
        title: "报告中心",
        group: "工作空间",
        description: "报告生成、管理与导出",
        component: () => import("../views/ReportCenterPage.vue"),
    },
    {
        key: "bom-export",
        path: "/bom-export",
        name: "BOMExport",
        title: "BOM 导出",
        group: "工作空间",
        description: "设计结果整理与物料导出",
        capabilityLevel: "reference",
        verificationLevel: "unverified",
        evidenceTags: ["BOM 汇总规则", "成本累计", "导出模板"],
        evidenceSummary: "BOM 导出页按类别、规格和供应商汇总原始条目，适合形成采购清单和归档导出，不替代 ERP 主数据。",
        governanceRefs: {
            sourceIds: ["mechbox_internal"],
            datasetIds: ["dataset_bom_internal_rules", "dataset_report_templates"],
            versionCodes: ["BOM_RULESET_V1", "REPORT_TEMPLATE_V1"],
        },
        component: () => import("../views/BOMExportPage.vue"),
    },
    {
        key: "documents",
        path: "/documents",
        name: "Documents",
        title: "文档中心",
        group: "工作空间",
        description: "统一检索项目、报告、文档、零件和变更对象",
        component: () => import("../views/DocumentCenterPage.vue"),
    },
    {
        key: "favorites",
        path: "/favorites",
        name: "Favorites",
        title: "我的收藏",
        group: "工作空间",
        description: "常用配置和结果收藏",
        component: () => import("../views/FavoritesPage.vue"),
    },
    {
        key: "settings",
        path: "/settings",
        name: "Settings",
        title: "设置",
        group: "系统",
        description: "界面、数据和企业级参数配置",
        component: () => import("../views/SettingsPage.vue"),
    },
    {
        key: "about",
        path: "/about",
        name: "About",
        title: "关于",
        group: "系统",
        description: "项目说明、版本和功能边界",
        component: () => import("../views/AboutPage.vue"),
    },
];

export const defaultRouteKey = "dashboard";

export const appRouteMetaByKey = Object.fromEntries(
    appRouteDefinitions.map((route) => [route.key, route]),
) as Record<string, AppRouteMeta>;

export const appRouteKeyByPath = Object.fromEntries(
    appRouteDefinitions.map((route) => [route.path, route.key]),
) as Record<string, string>;

export const moduleRouteMap: Record<string, string> = {
    ...Object.fromEntries(appRouteDefinitions.map((route) => [route.key, route.path])),
    threads: "/standard-parts",
};

export const routeRecords: RouteRecordRaw[] = appRouteDefinitions.map((route) => ({
    path: route.path,
    name: route.name,
    component: route.component,
}));

const routePreloadCache = new Map<string, Promise<void>>();

function resolveRouteComponentLoader(routeKey: string) {
    const component = appRouteMetaByKey[routeKey]?.component as unknown;
    return typeof component === "function" ? (component as RouteComponentLoader) : null;
}

export function preloadRouteComponent(routeKey: string) {
    const loader = resolveRouteComponentLoader(routeKey);
    if (!loader) {
        return Promise.resolve();
    }

    const cached = routePreloadCache.get(routeKey);
    if (cached) {
        return cached;
    }

    const pending = loader()
        .then(() => undefined)
        .catch((error) => {
            routePreloadCache.delete(routeKey);
            throw error;
        });

    routePreloadCache.set(routeKey, pending);
    return pending;
}

export function preloadRouteByPath(path: string) {
    const routeKey = appRouteKeyByPath[path];
    return routeKey ? preloadRouteComponent(routeKey) : Promise.resolve();
}

export function getRouteMetaByPath(path: string) {
    const routeKey = appRouteKeyByPath[path];
    return routeKey ? appRouteMetaByKey[routeKey] : undefined;
}
