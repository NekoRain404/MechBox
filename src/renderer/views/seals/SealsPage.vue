<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import AlertStack from '../../components/AlertStack.vue'
import CalculationDecisionPanel from '../../components/CalculationDecisionPanel.vue'
import DatabaseRuntimeBanner from '../../components/DatabaseRuntimeBanner.vue'
import PageToolbar from '../../components/PageToolbar.vue'
import FormulaPanel from '../../components/FormulaPanel.vue'
import ProjectContextCard from '../../components/ProjectContextCard.vue'
import { usePdfExport } from '../../composables/usePdfExport'
import { useFavorite } from '../../composables/useFavorite'
import { useActiveProject } from '../../composables/useActiveProject'
import { useWorkflowRecorder } from '../../composables/useWorkflowRecorder'
import { useAppFeedback } from '../../composables/useAppFeedback'
import { getElectronDb } from '../../utils/electron-db'
import { useStandardStore } from "../../store/useStandardStore";
import { calcCompression, calcStretch } from "../../engine/seals/oring";
import { calcSealMultiPhysics } from "../../engine/seals/multi-physics";
import { getReportModuleMeta } from '../../utils/reporting'
import { consumeToolLaunchPayload } from '../../utils/tool-launch'
import {
    InfoCircleOutlined,
    FilePdfOutlined,
    PrinterOutlined,
    SaveOutlined,
    StarOutlined,
    StarTwoTone,
    UndoOutlined,
} from "@ant-design/icons-vue";

const store = useStandardStore();
const UM_TO_MM = 0.001;
const runtimeNotice = ref("");
const runtimeMode = ref<"fallback" | "partial" | "missing">("fallback");
const pageNotice = ref("");
const { isExporting, exportPdf } = usePdfExport()
const { isFavorited, toggleFavorite, checkFavorite } = useFavorite()
const { activeProject } = useActiveProject()
const { recordModuleCalculation } = useWorkflowRecorder()
const feedback = useAppFeedback()
const reportMeta = getReportModuleMeta('seals')
const defaultSealType = "radial-outer";
const defaultIsStatic = true;
const defaultFormState = {
    selectedStandard: "std_as568",
    selectedDashCode: "214",
    d4: 25.0,
    d9: 24.5,
    d3: 20.0,
    b1: 3.6,
    r: 0.2,
    d1: 18.64,
    d2: 3.53,
    temperature: 23,
    pressure: 0,
    medium: "water",
    expansion: 0,
    hardness: 70,
};
const createDefaultTolCodes = () => ({
    d4: { pos: "H", grade: "IT8" },
    d9: { pos: "f", grade: "IT7" },
    d3: { pos: "h", grade: "IT9" },
});

const standardOptions = [
    { label: "AS568", value: "std_as568" },
    { label: "JIS B 2401", value: "std_jis_b_2401" },
];

const mediumOptions = [
    { label: "Water", value: "water" },
    { label: "Salt Water", value: "salt_water" },
    { label: "Steam < 300 F", value: "steam_under_300f" },
    { label: "Steam > 300 F", value: "steam_over_300f" },
    { label: "Diesel Oil", value: "diesel_oil" },
    { label: "White Oil", value: "white_oil" },
    { label: "Ethylene Glycol", value: "ethylene_glycol" },
    { label: "Brake Fluid", value: "brake_fluid_wagner_21b" },
    { label: "Skydrol 500", value: "skydrol_500" },
    { label: "Skydrol 7000", value: "skydrol_7000" },
    { label: "Acetone", value: "acetone" },
    { label: "Denatured Alcohol", value: "denatured_alcohol" },
    { label: "Ammonia", value: "ammonia_anhydrous" },
];

// 密封类型与状态
const sealType = ref(defaultSealType);
const isStatic = ref(defaultIsStatic);
const favoriteId = computed(
    () => `seal_${form.value.selectedStandard}_${form.value.selectedDashCode}_${sealType.value}_${isStatic.value ? "static" : "dynamic"}`,
);

// 输入参数表单
const form = ref({ ...defaultFormState });

const oringRecommendation = ref<any | null>(null);
const recommendationLoading = ref(false);
let recommendationRequestId = 0;

// 公差代号选择
const tolCodes = ref(createDefaultTolCodes());

// 实时公差偏差值 (从 DB 获取)
const deviations = ref({
    d4: { es: 0.033, ei: 0 },
    d9: { es: -0.02, ei: -0.041 },
    d3: { es: 0, ei: -0.052 },
});

// 下拉列表选项
const holePositions = ["H"];
const shaftPositions = ["h", "g", "f"];
const itGrades = ["IT5", "IT6", "IT7", "IT8", "IT9"];

// 导出 PDF 逻辑
const exportPDF = async () => {
    if (!canPersistSealResult.value) {
        feedback.warning("请先确认规格并修正关键输入后再导出 PDF。");
        return;
    }

    await exportPdf({
        selector: ".tss-style-page",
        filename: `MechBox-O-Ring-${form.value.selectedDashCode || "report"}`,
        reportRecord: {
            title: `密封圈 ${form.value.selectedDashCode} 计算书`,
            module: 'seals',
            projectNumber: activeProject.value?.id ?? form.value.selectedDashCode,
            projectId: activeProject.value?.id,
            projectName: activeProject.value?.name,
            standardRef: reportMeta.standardRef,
            author: '系统',
            summary: buildProjectSummary(),
        },
        onSuccess: () => {
            feedback.notifyExported('密封圈计算 PDF');
        },
    });
};

const getDb = () => {
    const db = getElectronDb();
    if (!db) {
        runtimeMode.value = "fallback";
        runtimeNotice.value =
            "数据库接口未就绪，当前密封圈页已切换到本地静态/JSON 回退模式。基础压缩、拉伸与多场校核仍可继续，但规则推荐和治理链会降级。";
        return null;
    }
    return db;
};

const printReport = () => {
    window.print();
};

const applyFallbackSpec = (code: string) => {
    const fallbackSpec = store.oringList.find((item) => item.code === code);
    if (fallbackSpec) {
        form.value.d1 = fallbackSpec.id;
        form.value.d2 = fallbackSpec.cs;
    }
};

const selectedOringSpec = computed(
    () =>
        store.oringList.find(
            (item) => item.code === form.value.selectedDashCode,
        ) ?? null,
);
const hasNamedSeal = computed(() => Boolean(form.value.selectedDashCode?.trim()));
const recommendationQueryReady = computed(() =>
    Boolean(
        hasNamedSeal.value &&
            form.value.d1 > 0 &&
            form.value.d2 > 0 &&
            form.value.b1 > 0 &&
            form.value.hardness > 0 &&
            form.value.d4 > form.value.d3 &&
            form.value.d4 > form.value.d9,
    ),
);

const inputAlerts = computed(() => {
    const alerts: Array<{ level: "warning" | "error"; message: string; description?: string }> = [];

    if (!hasNamedSeal.value) {
        alerts.push({
            level: "warning",
            message: "当前未选择标准规格代码。",
            description: "页面会按手工尺寸继续计算，但导出、收藏和项目留痕建议在选定标准规格后再执行。",
        });
    } else if (!selectedOringSpec.value) {
        alerts.push({
            level: "warning",
            message: "当前规格代码不在已加载标准表内。",
            description: "系统会保留手工尺寸继续计算，建议回到标准规格列表重新确认。",
        });
    }

    if (form.value.d2 <= 0) {
        alerts.push({
            level: "error",
            message: "O 形圈线径必须大于 0 mm。",
            description: "线径为 0 时压缩率、槽满率和多场校核都不成立。",
        });
    }
    if (form.value.d1 <= 0) {
        alerts.push({
            level: "error",
            message: "O 形圈内径必须大于 0 mm。",
            description: "请输入有效内径后再判断拉伸率。",
        });
    }
    if (form.value.d4 <= 0 || form.value.d9 <= 0 || form.value.d3 <= 0) {
        alerts.push({
            level: "error",
            message: "缸孔、活塞和沟槽底径都必须大于 0 mm。",
            description: "当前几何尺寸不足以形成有效密封截面。",
        });
    }
    if (form.value.d4 <= form.value.d3) {
        alerts.push({
            level: "error",
            message: "缸孔直径 d4 必须大于沟槽底径 d3。",
            description: "否则沟槽深度会小于等于 0，压缩率和槽体积计算失效。",
        });
    }
    if (form.value.d4 <= form.value.d9) {
        alerts.push({
            level: "error",
            message: "缸孔直径 d4 必须大于活塞直径 d9。",
            description: "否则配合间隙为负或为零，当前防挤出和装配间隙判断不成立。",
        });
    }
    if (form.value.b1 <= 0) {
        alerts.push({
            level: "error",
            message: "沟槽宽度 b1 必须大于 0 mm。",
            description: "槽满率和推荐槽宽判断都需要有效沟槽宽度。",
        });
    }
    if (form.value.hardness <= 0) {
        alerts.push({
            level: "error",
            message: "材料硬度必须大于 0 Shore A。",
        });
    } else if (form.value.hardness < 60 || form.value.hardness > 95) {
        alerts.push({
            level: "warning",
            message: "当前硬度超出常见 60~95 Shore A 范围。",
            description: "请确认是否使用了非常规材料或特殊防挤出方案。",
        });
    }
    if (form.value.pressure < 0) {
        alerts.push({
            level: "error",
            message: "工作压力不能为负。",
        });
    } else if (form.value.pressure > 40) {
        alerts.push({
            level: "warning",
            message: "当前压力已经进入高压边界区。",
            description: "建议重点复核间隙、硬度和挡圈配置，不要只看基础压缩率。",
        });
    }
    if (form.value.temperature < -60 || form.value.temperature > 230) {
        alerts.push({
            level: "warning",
            message: "当前温度超出常见 O 形圈经验窗口。",
            description: "简化材料模型仍会计算，但正式定型需要回到材料手册复核。",
        });
    }

    return alerts;
});
const canShowResults = computed(
    () => !inputAlerts.value.some((item) => item.level === "error"),
);
const canPersistSealResult = computed(
    () => canShowResults.value && hasNamedSeal.value,
);
const emptyDescription = computed(() => {
    const firstError = inputAlerts.value.find((item) => item.level === "error");
    if (firstError) return firstError.message;
    if (!hasNamedSeal.value) return "请先选择标准规格代码";
    return "当前输入组合暂无可展示结果";
});

function normalizeToleranceCode(
    value: unknown,
    fallback: { pos: string; grade: string },
) {
    if (!value || typeof value !== "object") return fallback;
    const record = value as Record<string, unknown>;
    return {
        pos: typeof record.pos === "string" && record.pos ? record.pos : fallback.pos,
        grade: typeof record.grade === "string" && record.grade ? record.grade : fallback.grade,
    };
}

async function applySealLaunchPayload(payload: unknown) {
    if (!payload || typeof payload !== "object") return false;

    const record = payload as Record<string, unknown>;
    const formRecord =
        record.form && typeof record.form === "object"
            ? (record.form as Record<string, unknown>)
            : {};
    let applied = false;

    const nextForm = { ...form.value };
    const nextStandard =
        typeof record.standard === "string"
            ? record.standard
            : typeof formRecord.selectedStandard === "string"
              ? formRecord.selectedStandard
              : nextForm.selectedStandard;
    const nextDashCode =
        typeof record.dashCode === "string"
            ? record.dashCode
            : typeof formRecord.selectedDashCode === "string"
              ? formRecord.selectedDashCode
              : nextForm.selectedDashCode;

    nextForm.selectedStandard = nextStandard;
    nextForm.selectedDashCode = nextDashCode;

    for (const key of ["d4", "d9", "d3", "b1", "r", "d1", "d2", "temperature", "pressure", "expansion", "hardness"] as const) {
        const numericValue = Number(formRecord[key]);
        if (Number.isFinite(numericValue)) {
            nextForm[key] = numericValue;
            applied = true;
        }
    }

    if (typeof formRecord.medium === "string" && formRecord.medium) {
        nextForm.medium = formRecord.medium;
        applied = true;
    }

    if (nextStandard !== form.value.selectedStandard || nextDashCode !== form.value.selectedDashCode) {
        applied = true;
    }

    if (typeof record.sealType === "string" && record.sealType) {
        sealType.value = record.sealType;
        applied = true;
    }
    if (typeof record.isStatic === "boolean") {
        isStatic.value = record.isStatic;
        applied = true;
    }

    form.value = nextForm;

    if (record.tolerances && typeof record.tolerances === "object") {
        const toleranceRecord = record.tolerances as Record<string, unknown>;
        tolCodes.value = {
            d4: normalizeToleranceCode(toleranceRecord.d4, tolCodes.value.d4),
            d9: normalizeToleranceCode(toleranceRecord.d9, tolCodes.value.d9),
            d3: normalizeToleranceCode(toleranceRecord.d3, tolCodes.value.d3),
        };
        applied = true;
    }

    await store.fetchOringList(form.value.selectedStandard);
    await onOringSelect(form.value.selectedDashCode);
    await Promise.all([
        updateDeviations("d4"),
        updateDeviations("d9"),
        updateDeviations("d3"),
    ]);
    await refreshOringRecommendation();
    activeFormulaSection.value = "尺寸、压缩与拉伸";
    return applied;
}

async function resetSealInputs() {
    sealType.value = defaultSealType;
    isStatic.value = defaultIsStatic;
    form.value = { ...defaultFormState };
    tolCodes.value = createDefaultTolCodes();
    pageNotice.value = "";
    oringRecommendation.value = null;

    await store.fetchOringList(form.value.selectedStandard);
    await onOringSelect(form.value.selectedDashCode);
    await Promise.all([
        updateDeviations("d4"),
        updateDeviations("d9"),
        updateDeviations("d3"),
    ]);
    await refreshOringRecommendation();
    activeFormulaSection.value = "尺寸、压缩与拉伸";
}

// 监听尺寸或公差代号变化，更新数据库偏差
const updateDeviations = async (key: "d4" | "d9" | "d3") => {
    const size = form.value[key];
    const { pos, grade } = tolCodes.value[key];
    const sizeIndex = store.getSizeRangeIndex(size);

    if (sizeIndex === -1) return;

    const type = key === "d4" ? "holes" : "shafts";
    const [it, dev] = await Promise.all([
        store.getITValue(grade, sizeIndex),
        store.getFundamentalDeviation(type, pos, sizeIndex),
    ]);

    if (it !== null && dev !== null) {
        const itMm = it * UM_TO_MM;
        const devMm = dev * UM_TO_MM;
        if (type === "holes") {
            // 基准孔 H: EI=0, ES=IT
            deviations.value[key].ei = devMm;
            deviations.value[key].es = devMm + itMm;
        } else {
            // 轴: g, f 等偏差通常为 es
            deviations.value[key].es = devMm;
            deviations.value[key].ei = devMm - itMm;
        }
    }
};

watch(
    () => [form.value.d4, tolCodes.value.d4],
    () => updateDeviations("d4"),
    { deep: true },
);
watch(
    () => [form.value.d9, tolCodes.value.d9],
    () => updateDeviations("d9"),
    { deep: true },
);
watch(
    () => [form.value.d3, tolCodes.value.d3],
    () => updateDeviations("d3"),
    { deep: true },
);

// 规格自动填充
const onOringSelect = async (value: unknown) => {
    if (typeof value !== "string" || !value) return;
    const code = value;
    form.value.selectedDashCode = code;
    const db = getDb();
    if (!db) {
        applyFallbackSpec(code);
        return;
    }

    try {
        const spec = await db.queryOringSpec(
            form.value.selectedStandard,
            code,
        );
        if (spec) {
            form.value.d1 = spec.id;
            form.value.d2 = spec.cs;
        }
        pageNotice.value = "";
    } catch (_error) {
        applyFallbackSpec(code);
        pageNotice.value = "O 形圈规格查询失败，当前已优先保留本地规格或手工输入值。";
    }
};

const toMultiPhysicsMaterial = (
    materialCode?: string,
): "NBR" | "FKM" | "EPDM" | "VMQ" => {
    if (materialCode === "FKM") return "FKM";
    if (materialCode === "EPDM") return "EPDM";
    if (materialCode === "VMQ" || materialCode === "FVMQ") return "VMQ";
    return "NBR";
};

const toMultiPhysicsMedium = (
    medium: string,
): "mineral_oil" | "fuel" | "water" | "air" => {
    if (["diesel_oil", "red_oil_mil_h_5606"].includes(medium)) return "fuel";
    if (["white_oil", "stoddard_solvent"].includes(medium))
        return "mineral_oil";
    if (
        [
            "water",
            "salt_water",
            "steam_under_300f",
            "steam_over_300f",
            "ethylene_glycol",
            "brake_fluid_wagner_21b",
            "skydrol_500",
            "skydrol_7000",
        ].includes(medium)
    ) {
        return "water";
    }
    return "air";
};

const refreshOringRecommendation = async () => {
    const requestId = ++recommendationRequestId;
    if (!recommendationQueryReady.value) {
        recommendationLoading.value = false;
        oringRecommendation.value = null;
        return;
    }
    recommendationLoading.value = true;
    const db = getDb();
    if (!db) {
        recommendationLoading.value = false;
        oringRecommendation.value = null;
        return;
    }
    try {
        const recommendation = await db.queryOringRecommendation({
            standard: form.value.selectedStandard,
            dashCode: form.value.selectedDashCode || undefined,
            crossSection: form.value.d2,
            application: sealType.value as "radial-outer" | "radial-inner" | "axial",
            isStatic: isStatic.value,
            medium: form.value.medium,
            temperatureC: form.value.temperature,
            pressureMpa: form.value.pressure,
            hardness: form.value.hardness,
            clearanceMm: limits.value.maxClearance,
            glandDiameterMm: form.value.d3,
            grooveDepthMm: (form.value.d4 - form.value.d3) / 2,
            grooveWidthMm: form.value.b1,
            candidateLimit: 6,
        });
        if (requestId === recommendationRequestId) {
            oringRecommendation.value = recommendation;
            pageNotice.value = "";
        }
    } catch (_error) {
        if (requestId === recommendationRequestId) {
            oringRecommendation.value = null;
            pageNotice.value = "规则推荐读取失败，已保留基础几何、压缩率与多场校核结果。";
        }
    } finally {
        if (requestId === recommendationRequestId) {
            recommendationLoading.value = false;
        }
    }
};

// 计算结果
const results = computed(() => {
    const cs = form.value.d2;
    const depth = (form.value.d4 - form.value.d3) / 2;
    const comp = calcCompression(cs, depth);
    const str = calcStretch(form.value.d1, form.value.d3);
    const clearance = (form.value.d4 - form.value.d9) / 2;
    const fillRate =
        ((Math.PI * Math.pow(cs / 2, 2)) / (depth * form.value.b1)) * 100;
    const recommendedMaterial = toMultiPhysicsMaterial(
        oringRecommendation.value?.recommendedMaterial?.materialCode,
    );
    const simplifiedMedium = toMultiPhysicsMedium(form.value.medium);

    // 多场耦合计算 (Section 10.1)
    const multiPhysics = calcSealMultiPhysics({
        cs,
        id: form.value.d1,
        grooveDepth: depth,
        grooveWidth: form.value.b1,
        clearance,
        temperature: form.value.temperature || 20,
        pressure: form.value.pressure || 0,
        material: recommendedMaterial,
        medium: simplifiedMedium,
        application: isStatic.value ? "static" : "reciprocating",
    });

    return { compression: comp, stretch: str, clearance, fillRate, multiPhysics };
});

// 偏心/极限工况计算
const limits = computed(() => {
    const cs = form.value.d2;
    const csTol = 0.08; // 简化的标准公差 +/- 0.08
    const minCS = cs - csTol;
    const maxCS = cs + csTol;

    const minD4 = form.value.d4 + deviations.value.d4.ei;
    const maxD4 = form.value.d4 + deviations.value.d4.es;

    const minD3 = form.value.d3 + deviations.value.d3.ei;
    const maxD3 = form.value.d3 + deviations.value.d3.es;

    const minD9 = form.value.d9 + deviations.value.d9.ei;
    const maxD9 = form.value.d9 + deviations.value.d9.es;

    const minDepth = (minD4 - maxD3) / 2;
    const maxDepth = (maxD4 - minD3) / 2;

    const minComp = calcCompression(minCS, maxDepth);
    const maxComp = calcCompression(maxCS, minDepth);
    const maxClearance = (maxD4 - minD9) / 2;

    return { minComp, maxComp, maxClearance };
});

const recommendedMaterialText = computed(() => {
    const recommendation = oringRecommendation.value?.recommendedMaterial;
    if (!recommendation) return "待查询";
    const rating = recommendation.rating
        ? ` / ${String(recommendation.rating).toUpperCase()}`
        : "";
    return `${recommendation.materialCode} ${recommendation.hardnessShoreA ?? ""}${rating}`.trim();
});

const backupRingText = computed(() => {
    const backup = oringRecommendation.value?.backupRing;
    if (!backup) return "待查询";
    if (!backup.needed) return "不需要";
    return `需要 ${backup.count} 道`;
});

const glandDepthText = computed(() => {
    const gland = oringRecommendation.value?.gland?.valuesMm;
    if (!gland?.gland_depth_min_mm || !gland?.gland_depth_max_mm) return "--";
    return `${gland.gland_depth_min_mm.toFixed(2)} ~ ${gland.gland_depth_max_mm.toFixed(2)} mm`;
});

const glandWidthText = computed(() => {
    const gland = oringRecommendation.value?.gland;
    if (!gland?.valuesMm) return "--";
    if (gland.mode === "face") {
        const min = gland.valuesMm.groove_width_liquid_min_mm;
        const max = gland.valuesMm.groove_width_liquid_max_mm;
        return min && max ? `${min.toFixed(2)} ~ ${max.toFixed(2)} mm` : "--";
    }

    const prefix = gland.backupRingCount >= 1 ? "groove_width_one_backup" : "groove_width_no_backup";
    const min = gland.valuesMm[`${prefix}_min_mm`];
    const max = gland.valuesMm[`${prefix}_max_mm`];
    return min && max ? `${min.toFixed(2)} ~ ${max.toFixed(2)} mm` : "--";
});

const recommendationNote = computed(() => {
    const recommendation = oringRecommendation.value;
    if (!recommendation) return "";
    if (recommendation.mediumKey && recommendation.mediumKey !== form.value.medium) {
        return `兼容性按 ${recommendation.mediumLabel} 近似匹配`;
    }
    return recommendation.extrusion?.materialDeratingApplied
        ? "硅胶/氟硅胶按 50% 间隙降额校核"
        : "";
});

const materialCandidates = computed(() =>
    (oringRecommendation.value?.recommendedMaterials ?? []).slice(0, 4),
);

const projectMetrics = computed(() => {
    if (!canShowResults.value) {
        return [{ label: "当前规格", value: form.value.selectedDashCode || "--" }];
    }

    return [
        { label: "当前规格", value: form.value.selectedDashCode || "--" },
        { label: "基础压缩率", value: `${results.value.compression.value.toFixed(1)} %` },
        { label: "修正压缩率", value: `${results.value.multiPhysics.value.adjustedCompression.toFixed(1)} %` },
    ];
});
const resultSummaryCards = computed(() => {
    if (!canShowResults.value) return [];

    return [
        {
            label: "当前规格",
            value: form.value.selectedDashCode || "--",
            hint: `${form.value.d1.toFixed(2)} x ${form.value.d2.toFixed(2)} mm`,
            emphasis: true,
        },
        {
            label: "基础压缩率",
            value: `${results.value.compression.value.toFixed(1)} %`,
            hint: results.value.compression.warnings.length ? "已偏离常用窗口" : "当前几何压缩正常",
        },
        {
            label: "修正压缩率",
            value: `${results.value.multiPhysics.value.adjustedCompression.toFixed(1)} %`,
            hint: `${form.value.temperature} °C / ${form.value.pressure} MPa 工况`,
        },
        {
            label: "槽满率",
            value: `${results.value.fillRate.toFixed(1)} %`,
            hint: results.value.fillRate > 85 ? "高温余量偏紧" : "槽内容量仍有余量",
        },
        {
            label: "材料与挡圈",
            value: recommendedMaterialText.value,
            hint: results.value.multiPhysics.value.extrusionRisk || oringRecommendation.value?.backupRing?.needed
                ? `挡圈建议: ${backupRingText.value}`
                : "当前未触发明显防挤出风险",
        },
    ];
});

const sizeCandidates = computed(() =>
    oringRecommendation.value?.sizeCandidates ?? [],
);

const sealAlerts = computed(() => [
    ...results.value.compression.warnings,
    ...results.value.stretch.warnings,
    ...results.value.multiPhysics.value.warnings,
]);

const pageAlerts = computed(() => {
    const alerts: Array<{ level: "warning" | "info"; message: string; description?: string }> = [];
    if (pageNotice.value) {
        alerts.push({
            level: "warning",
            message: pageNotice.value,
        });
    }
    if (recommendationQueryReady.value && !oringRecommendation.value && !recommendationLoading.value) {
        alerts.push({
            level: "info",
            message: "当前未形成规则推荐链",
            description: "页面仍可继续做压缩率、拉伸率、槽满率与热-力-化多场基础校核。",
        });
    }
    if (!activeProject.value) {
        alerts.push({
            level: "warning",
            message: "当前没有活动项目上下文",
            description: "建议把最终沟槽与材料结论写入项目，避免密封圈计算结果停留在单页状态。",
        });
    }
    return alerts;
});

const applySizeCandidate = async (candidate: {
    dashCode: string;
    innerDiameterMm: number;
    crossSectionMm: number;
}) => {
    form.value.selectedDashCode = candidate.dashCode;
    form.value.d1 = candidate.innerDiameterMm;
    form.value.d2 = candidate.crossSectionMm;
    await onOringSelect(candidate.dashCode);
};

const squeezeCriteriaText = computed(() => {
    const criteria = oringRecommendation.value?.sizingCriteria?.squeezeWindowPct;
    if (!criteria?.min && criteria?.min !== 0) return "--";
    return `${criteria.min.toFixed(0)} ~ ${criteria.max.toFixed(0)} %`;
});

const stretchCriteriaText = computed(() => {
    const criteria = oringRecommendation.value?.sizingCriteria?.stretchWindowPct;
    if (!criteria?.min && criteria?.min !== 0) return "--";
    return `${criteria.min.toFixed(0)} ~ ${criteria.max.toFixed(0)} %`;
});

const runtimeDetails = computed(() => {
    if (!runtimeNotice.value) return [];
    return [
        "基础几何、公差、压缩率、拉伸率和热-力-化简化校核继续使用本地引擎计算。",
        "规格搜索与材质/挡圈/沟槽规则推荐优先依赖 SQLite；降级后会回落到本地 O 形圈规格集和内置治理快照。",
    ];
});

const decisionPanel = computed(() => {
    if (!canShowResults.value) return null;

    const compression = results.value.compression.value;
    const adjustedCompression = results.value.multiPhysics.value.adjustedCompression;
    const fillRate = results.value.fillRate;
    const extrusionRisk = results.value.multiPhysics.value.extrusionRisk;
    const status: "success" | "info" | "warning" | "error" =
        extrusionRisk || adjustedCompression > 35 || fillRate > 100
            ? "error"
            : sealAlerts.value.some((warning) => warning.level === "error")
              ? "error"
              : sealAlerts.value.some((warning) => warning.level === "warning")
                ? "warning"
                : compression >= 12 && compression <= 28 && fillRate <= 85
                  ? "success"
                  : "info";

    const risks: string[] = [];
    const actions: string[] = [];

    if (results.value.compression.warnings.length) {
        risks.push("基础压缩率已偏离常用静密封窗口，泄漏或过压缩风险上升。");
        actions.push("优先调整沟槽深度或改用更合适的线径。");
    }
    if (results.value.stretch.warnings.length) {
        risks.push("内径拉伸率偏高，长期寿命与安装状态会受影响。");
        actions.push("优先选择更接近沟槽直径的 O 形圈内径。");
    }
    if (fillRate > 85) {
        risks.push(`当前槽满率约 ${fillRate.toFixed(1)}%，热胀或介质溶胀后余量偏紧。`);
        actions.push("增大沟槽宽度或降低线径，避免高温下槽内无余量。");
    }
    if (extrusionRisk) {
        risks.push("当前压力-硬度-间隙组合已触发防挤出风险。");
        actions.push("减小配合间隙，或补加挡圈并提高材料硬度。");
    } else if (oringRecommendation.value?.backupRing?.needed) {
        risks.push("规则链建议增加挡圈，说明当前间隙和压力组合已经接近边界。");
        actions.push("按推荐挡圈道数复核沟槽宽度，并重新确认装配空间。");
    }

    return {
        conclusion: `当前 ${form.value.selectedDashCode} 规格在 ${form.value.temperature} °C / ${form.value.pressure} MPa 下，基础压缩率约 ${compression.toFixed(1)}%，修正压缩率约 ${adjustedCompression.toFixed(1)}%。`,
        status,
        risks,
        actions: actions.length
            ? actions
            : ["继续结合介质、温度和寿命要求复核材料选型，再决定是否定版。"],
        boundaries: [
            "当前页面以 O 形圈规格表、显式几何公式和规则推荐链做筛查，不替代完整厂商手册设计流程。",
            "热-力-化多场校核使用简化材料与介质模型，正式设计仍需回到标准或厂商资料复核。",
        ],
    };
});

const formulaSections = computed(() => [
    {
        title: "尺寸、压缩与拉伸",
        formulas: [
            "depth = (d4 - d3) / 2",
            "compression = (CS - depth) / CS · 100%",
            "stretch = (glandID - ID) / ID · 100%",
            "clearance = (d4 - d9) / 2",
        ],
        variables: ["CS: O 形圈线径", "ID: O 形圈内径", "d4/d9/d3: 配合与沟槽直径"],
        notes: ["压缩率、拉伸率和间隙都直接对应当前页面的基础校核结果。"],
    },
    {
        title: "槽满率与规格候选",
        formulas: [
            "fill = π(CS/2)² / (depth · b1) · 100%",
            "candidate = squeeze + stretch + fill 窗口匹配",
        ],
        variables: ["b1: 沟槽宽度"],
        notes: ["规格候选会附带压缩率、拉伸率和槽满率的命中或偏离原因。"],
    },
    {
        title: "热-力-化多场耦合",
        formulas: [
            "ΔCSthermal = CS · (1 + αΔT) - CS",
            "CSswollen = CSthermal · (1 + swell / 300)",
            "adjustedCompression = (CSswollen - depth) / CSswollen · 100%",
            "fillmulti = Vseal / Vgroove · 100%",
        ],
        variables: ["α: 热膨胀系数", "swell: 介质溶胀率", "Vseal/Vgroove: 密封圈与沟槽体积"],
        notes: ["防挤出风险按压力-硬度-间隙规则表判定，超限时建议加挡圈。"],
    },
])
const activeFormulaSection = ref("尺寸、压缩与拉伸");

function buildProjectSummary() {
    if (!canShowResults.value) {
        return "密封圈结果尚未形成，请先修正关键几何和工况输入。";
    }
    return `密封圈 ${form.value.selectedDashCode}：基础压缩率 ${results.value.compression.value.toFixed(1)}%，修正压缩率 ${results.value.multiPhysics.value.adjustedCompression.toFixed(1)}%，槽满率 ${results.value.fillRate.toFixed(1)}%，介质 ${form.value.medium}，建议材料 ${recommendedMaterialText.value}。`;
}

async function syncToProject() {
    if (!canPersistSealResult.value || !decisionPanel.value) {
        feedback.warning("请先修正输入并确认规格后再写入项目。");
        return;
    }
    if (!activeProject.value) {
        feedback.warning('当前没有活动项目，无法写入摘要');
        return;
    }

    await recordModuleCalculation({
        module: 'seals',
        name: `密封圈 ${form.value.selectedDashCode}`,
        projectSummary: buildProjectSummary(),
        inputData: {
            standard: form.value.selectedStandard,
            dashCode: form.value.selectedDashCode,
            sealType: sealType.value,
            isStatic: isStatic.value,
            form: { ...form.value },
            tolerances: { ...tolCodes.value },
        },
        contextData: {
            deviations: { ...deviations.value },
            recommendation: oringRecommendation.value,
            limits: limits.value,
            alerts: sealAlerts.value,
        },
        outputData: {
            compression: results.value.compression,
            stretch: results.value.stretch,
            clearance: results.value.clearance,
            fillRate: results.value.fillRate,
            multiPhysics: results.value.multiPhysics,
            recommendedMaterial: recommendedMaterialText.value,
            backupRing: backupRingText.value,
        },
        recentData: {
            standard: form.value.selectedStandard,
            dashCode: form.value.selectedDashCode,
            sealType: sealType.value,
            isStatic: isStatic.value,
            form: { ...form.value },
            results: {
                compression: results.value.compression.value,
                stretch: results.value.stretch.value,
                fillRate: results.value.fillRate,
                adjustedCompression: results.value.multiPhysics.value.adjustedCompression,
                extrusionRisk: results.value.multiPhysics.value.extrusionRisk,
                recommendedMaterial: recommendedMaterialText.value,
            },
        },
        decisionData: decisionPanel.value,
        derivedMetrics: {
            compression: results.value.compression.value,
            stretch: results.value.stretch.value,
            fillRate: results.value.fillRate,
            adjustedCompression: results.value.multiPhysics.value.adjustedCompression,
            extrusionRisk: results.value.multiPhysics.value.extrusionRisk ? 1 : 0,
        },
    })
    feedback.notifySaved('项目摘要');
}

function handleToggleFavorite() {
    if (!canPersistSealResult.value) {
        feedback.warning("请先选择规格并修正输入后再收藏。");
        return;
    }

    toggleFavorite(favoriteId.value, {
        module: 'seals',
        name: `密封圈 ${form.value.selectedDashCode}`,
        data: {
            standard: form.value.selectedStandard,
            dashCode: form.value.selectedDashCode,
            sealType: sealType.value,
            isStatic: isStatic.value,
            form: { ...form.value },
            results: {
                compression: results.value.compression.value,
                stretch: results.value.stretch.value,
                fillRate: results.value.fillRate,
                adjustedCompression: results.value.multiPhysics.value.adjustedCompression,
                recommendedMaterial: recommendedMaterialText.value,
            },
        },
    });
}

watch(
    () => form.value.selectedStandard,
    async (standard) => {
        await store.fetchOringList(standard);
        const exists = store.oringList.some(
            (item) => item.code === form.value.selectedDashCode,
        );
        if (!exists && store.oringList[0]) {
            form.value.selectedDashCode = store.oringList[0].code;
            form.value.d1 = store.oringList[0].id;
            form.value.d2 = store.oringList[0].cs;
        }
    },
    { immediate: true },
);

watch(
    () => [
        form.value.selectedStandard,
        form.value.selectedDashCode,
        form.value.d2,
        form.value.temperature,
        form.value.pressure,
        form.value.medium,
        form.value.hardness,
        sealType.value,
        limits.value.maxClearance,
    ],
    () => {
        void refreshOringRecommendation();
    },
    { deep: true },
);

watch(favoriteId, (id) => {
    checkFavorite(id);
});

onMounted(async () => {
    try {
        checkFavorite(favoriteId.value);
        const launch = consumeToolLaunchPayload('seals');
        if (launch && await applySealLaunchPayload(launch.payload)) {
            feedback.info(`已恢复${launch.sourceLabel ?? '上次'}参数`);
            checkFavorite(favoriteId.value);
            return;
        }
        await onOringSelect(form.value.selectedDashCode);
        await Promise.all([
            updateDeviations("d4"),
            updateDeviations("d9"),
            updateDeviations("d3"),
        ]);
        await refreshOringRecommendation();
    } catch (_error) {
        pageNotice.value = "密封圈页面初始化失败，已保留可编辑输入参数与基础校核能力。";
    }
});
</script>

<template>
    <div class="tss-style-page">
        <!-- 顶部工具栏 -->
        <PageToolbar title="MechBox" subtitle="密封圈模块">
            <a-space>
                <a-button size="small" @click="resetSealInputs">
                    <template #icon><UndoOutlined /></template>恢复默认
                </a-button>
                <a-button size="small" :disabled="!canPersistSealResult" @click="syncToProject">
                    <template #icon><SaveOutlined /></template>写入项目
                </a-button>
                <a-button size="small" :disabled="!hasNamedSeal" @click="handleToggleFavorite">
                    <template #icon>
                        <StarTwoTone v-if="isFavorited" two-tone-color="#faad14" />
                        <StarOutlined v-else />
                    </template>
                    {{ isFavorited ? "已收藏" : "收藏" }}
                </a-button>
                <a-button size="small" type="primary" :disabled="isExporting || !canPersistSealResult" @click="exportPDF"
                    ><template #icon><FilePdfOutlined /></template
                    >创建PDF</a-button
                >
                <a-button size="small" @click="printReport"
                    ><template #icon><PrinterOutlined /></template
                    >打印报告</a-button
                >
                <a-tag color="blue">当前按 mm 计算</a-tag>
            </a-space>
        </PageToolbar>

        <a-tabs v-model:activeKey="sealType" class="type-tabs" centered>
            <a-tab-pane key="radial-outer" tab="径向外周密封" />
            <a-tab-pane key="radial-inner" tab="径向内周密封" />
            <a-tab-pane key="axial" tab="轴向密封" />
        </a-tabs>

        <div class="content-body">
            <DatabaseRuntimeBanner
                v-if="runtimeNotice"
                :mode="runtimeMode"
                :message="runtimeNotice"
                :details="runtimeDetails"
            />
            <a-row :gutter="16">
                <!-- 左侧：参数化 SVG 预览 -->
                <a-col :span="8">
                    <div class="schematic-container">
                        <div class="svg-preview">
                            <svg
                                width="100%"
                                height="300"
                                viewBox="0 0 250 300"
                            >
                                <!-- 缸体/座孔 (d4) -->
                                <rect
                                    x="25"
                                    y="50"
                                    width="200"
                                    height="20"
                                    fill="#ddd"
                                    stroke="#999"
                                />
                                <rect
                                    x="25"
                                    y="230"
                                    width="200"
                                    height="20"
                                    fill="#ddd"
                                    stroke="#999"
                                />

                                <!-- 轴/活塞 (d9 & d3) -->
                                <rect
                                    x="50"
                                    y="100"
                                    width="150"
                                    height="100"
                                    fill="#f0f0f0"
                                    stroke="#ccc"
                                />
                                <!-- 沟槽 (d3) -->
                                <rect
                                    x="50"
                                    y="120"
                                    width="40"
                                    height="60"
                                    fill="#fff"
                                    stroke="#999"
                                    stroke-dasharray="2"
                                />

                                <!-- O形圈 (d2 & d1) -->
                                <circle
                                    :cx="70"
                                    :cy="150"
                                    :r="form.d2 * 4"
                                    fill="rgba(0,130,148,0.6)"
                                    stroke="#008294"
                                />

                                <!-- 标注文本 -->
                                <text x="10" y="45" font-size="10">
                                    缸孔 d4: {{ form.d4 }}
                                </text>
                                <text x="10" y="115" font-size="10">
                                    活塞 d9: {{ form.d9 }}
                                </text>
                                <text x="10" y="215" font-size="10">
                                    沟槽 d3: {{ form.d3 }}
                                </text>
                            </svg>
                        </div>

                        <div class="search-box">
                            <div class="search-label">
                                O形圈规格快速选择
                            </div>
                            <a-select
                                v-model:value="form.selectedStandard"
                                :options="standardOptions"
                                style="width: 100%; margin-bottom: 8px"
                                size="small"
                            />
                            <a-select
                                show-search
                                placeholder="搜索规格代码 (如 010, 110...)"
                                style="width: 100%"
                                v-model:value="form.selectedDashCode"
                                @change="onOringSelect"
                            >
                                <a-select-option
                                    v-for="s in store.oringList"
                                    :key="s.code"
                                    :value="s.code"
                                >
                                    {{ s.code }} ({{ s.id }} x {{ s.cs }})
                                </a-select-option>
                            </a-select>
                        </div>

                        <ProjectContextCard
                            :active-project="activeProject"
                            current-module="seals"
                            current-module-label="密封圈"
                            :metrics="projectMetrics"
                            note="写入项目会同步登记当前密封圈结论到最近计算，便于项目中心和收藏页复用。"
                        />
                    </div>
                </a-col>

                <!-- 右侧：数据表格 -->
                <a-col :span="16">
                    <div class="input-section">
                        <div class="section-header">
                            <a-space :size="20">
                                <span
                                    class="mode-tag"
                                    :class="{ active: isStatic }"
                                    >静密封</span
                                >
                                <a-switch
                                    v-model:checked="isStatic"
                                    size="small"
                                />
                                <span
                                    class="mode-tag"
                                    :class="{ active: !isStatic }"
                                    >动密封</span
                                >
                            </a-space>
                        </div>

                        <table class="input-table">
                            <thead>
                                <tr>
                                    <th width="120">输入项</th>
                                    <th width="40">代号</th>
                                    <th width="100">公称尺寸</th>
                                    <th width="120">配合/公差</th>
                                    <th width="60">下偏差</th>
                                    <th width="60">上偏差</th>
                                    <th width="80">最小尺寸</th>
                                    <th width="80">最大尺寸</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>缸孔直径-Ø</td>
                                    <td>d4</td>
                                    <td>
                                        <a-input-number
                                            v-model:value="form.d4"
                                            size="small"
                                            :step="0.1"
                                        />
                                    </td>
                                    <td class="cell-flex">
                                        <a-select
                                            v-model:value="tolCodes.d4.pos"
                                            size="small"
                                            :options="
                                                holePositions.map((v) => ({
                                                    value: v,
                                                }))
                                            "
                                            style="width: 50px"
                                        />
                                        <a-select
                                            v-model:value="tolCodes.d4.grade"
                                            size="small"
                                            :options="
                                                itGrades.map((v) => ({
                                                    value: v,
                                                }))
                                            "
                                            style="width: 60px"
                                        />
                                    </td>
                                    <td class="dim-val">
                                        {{
                                            (deviations.d4.ei * 1000).toFixed(0)
                                        }}
                                    </td>
                                    <td class="dim-val">
                                        +{{
                                            (deviations.d4.es * 1000).toFixed(0)
                                        }}
                                    </td>
                                    <td class="dim-res">
                                        {{
                                            (
                                                form.d4 + deviations.d4.ei
                                            ).toFixed(3)
                                        }}
                                    </td>
                                    <td class="dim-res">
                                        {{
                                            (
                                                form.d4 + deviations.d4.es
                                            ).toFixed(3)
                                        }}
                                    </td>
                                </tr>
                                <tr>
                                    <td>活塞直径-Ø</td>
                                    <td>d9</td>
                                    <td>
                                        <a-input-number
                                            v-model:value="form.d9"
                                            size="small"
                                            :step="0.1"
                                        />
                                    </td>
                                    <td class="cell-flex">
                                        <a-select
                                            v-model:value="tolCodes.d9.pos"
                                            size="small"
                                            :options="
                                                shaftPositions.map((v) => ({
                                                    value: v,
                                                }))
                                            "
                                            style="width: 50px"
                                        />
                                        <a-select
                                            v-model:value="tolCodes.d9.grade"
                                            size="small"
                                            :options="
                                                itGrades.map((v) => ({
                                                    value: v,
                                                }))
                                            "
                                            style="width: 60px"
                                        />
                                    </td>
                                    <td class="dim-val">
                                        {{
                                            (deviations.d9.ei * 1000).toFixed(0)
                                        }}
                                    </td>
                                    <td class="dim-val">
                                        {{
                                            (deviations.d9.es * 1000).toFixed(0)
                                        }}
                                    </td>
                                    <td class="dim-res">
                                        {{
                                            (
                                                form.d9 + deviations.d9.ei
                                            ).toFixed(3)
                                        }}
                                    </td>
                                    <td class="dim-res">
                                        {{
                                            (
                                                form.d9 + deviations.d9.es
                                            ).toFixed(3)
                                        }}
                                    </td>
                                </tr>
                                <tr>
                                    <td>沟槽底径-Ø</td>
                                    <td>d3</td>
                                    <td>
                                        <a-input-number
                                            v-model:value="form.d3"
                                            size="small"
                                            :step="0.1"
                                        />
                                    </td>
                                    <td class="cell-flex">
                                        <a-select
                                            v-model:value="tolCodes.d3.pos"
                                            size="small"
                                            :options="
                                                shaftPositions.map((v) => ({
                                                    value: v,
                                                }))
                                            "
                                            style="width: 50px"
                                        />
                                        <a-select
                                            v-model:value="tolCodes.d3.grade"
                                            size="small"
                                            :options="
                                                itGrades.map((v) => ({
                                                    value: v,
                                                }))
                                            "
                                            style="width: 60px"
                                        />
                                    </td>
                                    <td class="dim-val">
                                        {{
                                            (deviations.d3.ei * 1000).toFixed(0)
                                        }}
                                    </td>
                                    <td class="dim-val">
                                        {{
                                            (deviations.d3.es * 1000).toFixed(0)
                                        }}
                                    </td>
                                    <td class="dim-res">
                                        {{
                                            (
                                                form.d3 + deviations.d3.ei
                                            ).toFixed(3)
                                        }}
                                    </td>
                                    <td class="dim-res">
                                        {{
                                            (
                                                form.d3 + deviations.d3.es
                                            ).toFixed(3)
                                        }}
                                    </td>
                                </tr>
                                <tr>
                                    <td>沟槽宽度</td>
                                    <td>b1</td>
                                    <td>
                                        <a-input-number
                                            v-model:value="form.b1"
                                            size="small"
                                            :step="0.1"
                                        />
                                    </td>
                                    <td><a-tag>推荐: 4.8</a-tag></td>
                                    <td
                                        colspan="4"
                                        style="
                                            background: #f9f9f9;
                                            text-align: center;
                                            color: #aaa;
                                        "
                                    >
                                        -- 自由公差 --
                                    </td>
                                </tr>
                                <tr style="background: #e6f7ff">
                                    <td>O形圈内径-Ø</td>
                                    <td>d1</td>
                                    <td>
                                        <a-input-number
                                            v-model:value="form.d1"
                                            size="small"
                                            :step="0.01"
                                        />
                                    </td>
                                    <td>
                                        <a-tag color="blue">ISO 3601</a-tag>
                                    </td>
                                    <td colspan="4" style="text-align: center">
                                        已通过规格搜索锁定
                                    </td>
                                </tr>
                                <tr style="background: #e6f7ff">
                                    <td>O形圈线径-Ø</td>
                                    <td>d2</td>
                                    <td>
                                        <a-input-number
                                            v-model:value="form.d2"
                                            size="small"
                                            :step="0.01"
                                        />
                                    </td>
                                    <td>
                                        <a-tag color="blue">ISO 3601</a-tag>
                                    </td>
                                    <td colspan="4" style="text-align: center">
                                        标准线径
                                    </td>
                                </tr>
                            </tbody>
                        </table>

                        <div class="condition-panel">
                            <div class="condition-header">
                                工况条件与规则推荐
                            </div>
                            <a-row :gutter="12">
                                <a-col :span="8">
                                    <div class="field-label">介质</div>
                                    <a-select
                                        v-model:value="form.medium"
                                        :options="mediumOptions"
                                        size="small"
                                        style="width: 100%"
                                    />
                                </a-col>
                                <a-col :span="5">
                                    <div class="field-label">温度 °C</div>
                                    <a-input-number
                                        v-model:value="form.temperature"
                                        size="small"
                                        :step="1"
                                        style="width: 100%"
                                    />
                                </a-col>
                                <a-col :span="5">
                                    <div class="field-label">压力 MPa</div>
                                    <a-input-number
                                        v-model:value="form.pressure"
                                        size="small"
                                        :step="0.1"
                                        style="width: 100%"
                                    />
                                </a-col>
                                <a-col :span="6">
                                    <div class="field-label">硬度 Shore A</div>
                                    <a-input-number
                                        v-model:value="form.hardness"
                                        size="small"
                                        :step="5"
                                        style="width: 100%"
                                    />
                                </a-col>
                            </a-row>
                            <div class="condition-note">
                                <span v-if="recommendationLoading">规则查询中...</span>
                                <span v-else-if="recommendationNote">{{
                                    recommendationNote
                                }}</span>
                                <span v-else>
                                    当前防挤出校核按最大装配间隙
                                    {{ limits.maxClearance.toFixed(3) }} mm
                                    进行
                                </span>
                            </div>
                            <div
                                v-if="materialCandidates.length"
                                class="candidate-strip"
                            >
                                <span class="candidate-title">材质候选</span>
                                <a-tag
                                    v-for="material in materialCandidates"
                                    :key="material.materialCode"
                                    :color="
                                        material.temperatureFit
                                            ? material.ratingScore >= 4
                                                ? 'green'
                                                : material.ratingScore >= 3
                                                  ? 'blue'
                                                  : 'orange'
                                            : 'red'
                                    "
                                >
                                    {{ material.materialCode }}
                                    {{ material.rating || "n/a" }}
                                </a-tag>
                            </div>
                        </div>

	                        <div class="result-section">
	                            <AlertStack :items="inputAlerts" class="inline-validation" />
	                            <AlertStack :items="pageAlerts" />
	                            <template v-if="canShowResults">
	                                <div class="tool-summary-strip">
	                                    <article
	                                        v-for="item in resultSummaryCards"
	                                        :key="item.label"
	                                        class="tool-summary-card"
	                                        :class="{ 'is-emphasis': item.emphasis }"
	                                    >
	                                        <div class="tool-summary-card__label">{{ item.label }}</div>
	                                        <div class="tool-summary-card__value">{{ item.value }}</div>
	                                        <div class="tool-summary-card__hint">{{ item.hint }}</div>
	                                    </article>
	                                </div>
	                            <a-row :gutter="16">
	                                <a-col :span="12">
	                                    <div class="result-column-header">
	                                        同心位置 (平均值)
                                    </div>
                                    <div class="result-grid">
                                        <div class="res-label">
                                            压缩率 [%]
                                            <InfoCircleOutlined
                                                class="info-icon"
                                            />
                                        </div>
                                        <div
                                            class="res-value"
                                            :class="{
                                                error: results.compression
                                                    .warnings.length,
                                            }"
                                        >
                                            {{
                                                results.compression.value.toFixed(
                                                    1,
                                                )
                                            }}
                                            %
                                        </div>
                                        <div class="res-label">
                                            单边间隙 g [mm]
                                        </div>
                                        <div class="res-value">
                                            {{ results.clearance.toFixed(3) }}
                                        </div>
                                        <div class="res-label">
                                            容积填充率 [%]
                                        </div>
                                        <div
                                            class="res-value"
                                            :class="{
                                                error: results.fillRate > 85,
                                            }"
                                        >
                                            {{ results.fillRate.toFixed(1) }} %
                                        </div>
                                        <div class="res-label">
                                            内径拉伸率 [%]
                                        </div>
                                        <div
                                            class="res-value"
                                            :class="{
                                                error: results.stretch.warnings
                                                    .length,
                                            }"
                                        >
                                            {{
                                                results.stretch.value.toFixed(1)
                                            }}
                                            %
                                        </div>
                                    </div>
                                </a-col>
                                <a-col :span="12">
                                    <div class="result-column-header">
                                        偏心/极限工况
                                    </div>
                                    <div class="result-grid">
                                        <div class="res-label">
                                            最小压缩率 (极限)
                                        </div>
                                        <div
                                            class="res-value"
                                            :class="{
                                                error: limits.minComp.warnings
                                                    .length,
                                            }"
                                        >
                                            {{
                                                limits.minComp.value.toFixed(1)
                                            }}
                                            %
                                        </div>
                                        <div class="res-label">
                                            最大压缩率 (极限)
                                        </div>
                                        <div
                                            class="res-value"
                                            :class="{
                                                error: limits.maxComp.warnings
                                                    .length,
                                            }"
                                        >
                                            {{
                                                limits.maxComp.value.toFixed(1)
                                            }}
                                            %
                                        </div>
                                        <div class="res-label">
                                            最大间隙 (含跳动)
                                        </div>
                                        <div class="res-value">
                                            {{
                                                limits.maxClearance.toFixed(3)
                                            }}
                                            mm
                                        </div>
                                        <div class="res-label">推荐材料</div>
                                        <div class="res-value">
                                            {{ recommendedMaterialText }}
                                        </div>
                                        <div class="res-label">防挤出挡圈</div>
                                        <div
                                            class="res-value"
                                            :class="{
                                                error: oringRecommendation
                                                    ?.backupRing?.needed,
                                            }"
                                        >
                                            {{ backupRingText }}
                                        </div>
                                        <div class="res-label">建议槽深</div>
                                        <div class="res-value">
                                            {{ glandDepthText }}
                                        </div>
                                        <div class="res-label">建议槽宽</div>
                                        <div class="res-value">
                                            {{ glandWidthText }}
                                        </div>
                                    </div>
                                </a-col>
                            </a-row>
                            
                            <!-- Section 10.1: 多场耦合计算结果 -->
                            <a-divider>热-力-化多场耦合校核</a-divider>
                            <div class="result-grid">
                                <div class="res-label">修正后压缩率 [%]</div>
                                <div class="res-value" :class="{ error: results.multiPhysics.value.adjustedCompression > 35 || results.multiPhysics.value.adjustedCompression < 10 }">
                                    {{ results.multiPhysics.value.adjustedCompression.toFixed(1) }} %
                                </div>
                                <div class="res-label">热膨胀量 [mm]</div>
                                <div class="res-value">{{ results.multiPhysics.value.thermalExpansion.toFixed(3) }}</div>
                                <div class="res-label">介质溶胀率 [%]</div>
                                <div class="res-value">{{ results.multiPhysics.value.swellingVolume.toFixed(1) }} %</div>
                                <div class="res-label">槽满率 [%]</div>
                                <div class="res-value" :class="{ error: results.multiPhysics.value.fillRate > 100 }">{{ results.multiPhysics.value.fillRate.toFixed(1) }} %</div>
                                <div class="res-label">挤出风险</div>
                                <div class="res-value" :class="{ error: results.multiPhysics.value.extrusionRisk }">
                                    {{ results.multiPhysics.value.extrusionRisk ? '有风险' : '可接受' }}
                                </div>
	                            </div>
	                            <AlertStack :items="sealAlerts" />
	                            <a-space wrap>
	                                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '尺寸、压缩与拉伸' }" @click="activeFormulaSection = '尺寸、压缩与拉伸'">查看压缩/拉伸</button>
	                                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '槽满率与规格候选' }" @click="activeFormulaSection = '槽满率与规格候选'">查看槽满率</button>
	                                <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '热-力-化多场耦合' }" @click="activeFormulaSection = '热-力-化多场耦合'">查看多场耦合</button>
	                            </a-space>
	                            </template>
	                            <a-empty v-else :description="emptyDescription" />
	                        </div>

	                        <div v-if="canShowResults" class="candidate-panel">
	                            <div class="candidate-panel-header">
	                                规格候选
	                                <span class="candidate-panel-meta">
                                    压缩率 {{ squeezeCriteriaText }} / 拉伸率
                                    {{ stretchCriteriaText }} / 槽满率 ≤
                                    {{
                                        oringRecommendation?.sizingCriteria
                                            ?.maxFillPct ?? 85
                                    }}
                                    %
                                </span>
                            </div>
                            <table class="candidate-table">
                                <thead>
                                    <tr>
                                        <th>规格</th>
                                        <th>ID x CS</th>
                                        <th>压缩率</th>
                                        <th>拉伸率</th>
                                        <th>槽满率</th>
                                        <th>状态</th>
                                        <th>推荐理由</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr
                                        v-for="candidate in sizeCandidates"
                                        :key="candidate.dashCode"
                                        :class="{
                                            'candidate-row-active':
                                                candidate.dashCode ===
                                                form.selectedDashCode,
                                        }"
                                    >
                                        <td>
                                            {{ candidate.dashCode }}
                                        </td>
                                        <td>
                                            {{ candidate.innerDiameterMm.toFixed(2) }}
                                            x
                                            {{
                                                candidate.crossSectionMm.toFixed(
                                                    2,
                                                )
                                            }}
                                        </td>
                                        <td>
                                            {{
                                                candidate.compressionPct.toFixed(
                                                    1,
                                                )
                                            }}
                                            %
                                        </td>
                                        <td>
                                            {{
                                                candidate.stretchPct.toFixed(1)
                                            }}
                                            %
                                        </td>
                                        <td>
                                            {{ candidate.fillPct.toFixed(1) }} %
                                        </td>
                                        <td>
                                            <a-tag
                                                :color="
                                                    candidate.withinCompression &&
                                                    candidate.withinStretch &&
                                                    candidate.withinFill
                                                        ? 'green'
                                                        : 'orange'
                                                "
                                            >
                                                {{
                                                    candidate.withinCompression &&
                                                    candidate.withinStretch &&
                                                    candidate.withinFill
                                                        ? '推荐'
                                                        : '可参考'
                                                }}
                                            </a-tag>
                                        </td>
                                        <td class="candidate-reason-cell">
                                            <span
                                                v-for="reason in candidate.reasons"
                                                :key="reason"
                                                class="candidate-reason"
                                                :class="{
                                                    'is-good':
                                                        reason.includes('命中') ||
                                                        reason.includes('安全') ||
                                                        reason.includes('接近'),
                                                    'is-warn':
                                                        reason.includes('偏低') ||
                                                        reason.includes('偏高'),
                                                }"
                                            >
                                                {{ reason }}
                                            </span>
                                        </td>
                                        <td>
                                            <a-button
                                                size="small"
                                                :type="
                                                    candidate.dashCode ===
                                                    form.selectedDashCode
                                                        ? 'primary'
                                                        : 'default'
                                                "
                                                @click="
                                                    applySizeCandidate(
                                                        candidate,
                                                    )
                                                "
                                            >
                                                {{
                                                    candidate.dashCode ===
                                                    form.selectedDashCode
                                                        ? "已选中"
                                                        : "应用"
                                                }}
                                            </a-button>
                                        </td>
                                    </tr>
                                    <tr v-if="!sizeCandidates.length">
                                        <td colspan="8" class="candidate-empty">
                                            需要当前沟槽尺寸和装配直径才能计算规格候选
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
	                        <CalculationDecisionPanel
	                            v-if="decisionPanel"
	                            title="密封判断"
	                            :conclusion="decisionPanel.conclusion"
	                            :status="decisionPanel.status"
                            :risks="decisionPanel.risks"
                            :actions="decisionPanel.actions"
                            :boundaries="decisionPanel.boundaries"
                        />
	                        <FormulaPanel v-if="canShowResults" v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
	                    </div>
	                </a-col>
            </a-row>
        </div>
    </div>
</template>

<style scoped>
.tss-style-page {
    font-size: 12px;
}

.type-tabs :deep(.ant-tabs-nav) {
    margin-bottom: 0;
    background: #fafafa;
    border-bottom: 1px solid #ddd;
}

.schematic-container {
    border: 1px solid #e8e8e8;
    padding: 12px;
    background: #fdfdfd;
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.svg-preview {
    border: 1px solid #eee;
    background: white;
    border-radius: 4px;
    overflow: hidden;
}

.search-label {
    font-size: 11px;
    color: #666;
    margin-bottom: 4px;
    font-weight: bold;
}
.input-section {
    border-left: 1px solid #f0f0f0;
    padding-left: 12px;
}
.condition-panel {
    margin-bottom: 12px;
    padding: 10px 12px;
    border: 1px solid #d9e8ec;
    background: #f8fcfd;
}
.condition-header {
    margin-bottom: 8px;
    font-weight: 700;
    color: #0b5d6b;
}
.field-label {
    margin-bottom: 4px;
    color: #666;
    font-size: 11px;
}
.condition-note {
    margin-top: 8px;
    color: #666;
    font-size: 11px;
}
.candidate-strip {
    margin-top: 10px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
}
.candidate-title {
    color: #666;
    font-size: 11px;
    font-weight: 700;
}

.section-header {
    margin-bottom: 8px;
    padding: 4px 8px;
    background: #f5f5f5;
    border-radius: 4px;
}
.mode-tag {
    color: #999;
    font-weight: bold;
    transition: color 0.3s;
}
.mode-tag.active {
    color: #008294;
}

.input-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
}
.input-table th {
    background: #f0f2f5;
    padding: 6px 4px;
    border: 1px solid #d9d9d9;
    font-weight: 600;
    text-align: center;
}
.input-table td {
    padding: 4px;
    border: 1px solid #d9d9d9;
    text-align: left;
}
.cell-flex {
    display: flex;
    gap: 2px;
    justify-content: center;
}

.dim-val {
    color: #1890ff;
    text-align: right;
    font-family: monospace;
    font-weight: bold;
}
.dim-res {
    background: #f5f5f5;
    text-align: right;
    font-weight: bold;
    font-family: monospace;
}

.candidate-panel {
    margin-top: 14px;
    border-top: 1px solid #dbe8ec;
    padding-top: 12px;
}
.candidate-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 8px;
    font-weight: 700;
    color: #0b5d6b;
}
.candidate-panel-meta {
    color: #666;
    font-size: 11px;
    font-weight: 400;
}
.candidate-table {
    width: 100%;
    border-collapse: collapse;
}
.candidate-table th {
    background: #eef5f7;
    border: 1px solid #d8e5ea;
    padding: 6px 4px;
    text-align: center;
}
.candidate-table td {
    border: 1px solid #e3edf1;
    padding: 6px 4px;
    text-align: center;
}
.candidate-reason-cell {
    text-align: left !important;
    min-width: 220px;
}
.candidate-reason {
    display: inline-block;
    margin: 2px 4px 2px 0;
    padding: 2px 6px;
    border-radius: 999px;
    background: #f2f4f5;
    color: #555;
    font-size: 11px;
    line-height: 1.5;
}
.candidate-reason.is-good {
    background: #f6ffed;
    color: #237804;
}
.candidate-reason.is-warn {
    background: #fff7e6;
    color: #ad6800;
}
.candidate-row-active td {
    background: #e6f7ff;
}
.candidate-empty {
    color: #888;
    background: #fafcfd;
}
</style>
