<script setup lang="ts">
/**
 * TolerancesPage.vue - 公差配合计算页面
 * 基于 ISO 286 / GB/T 1800 标准
 */
import { ref, computed, watch, watchEffect, onMounted } from "vue";
import PageToolbar from '../../components/PageToolbar.vue'
import FormulaPanel from '../../components/FormulaPanel.vue'
import ToolPageLayout from '../../components/ToolPageLayout.vue'
import InfoPanel from '../../components/InfoPanel.vue'
import ProjectContextCard from '../../components/ProjectContextCard.vue'
import ToolPresetBar from '../../components/ToolPresetBar.vue'
import CalculationDecisionPanel from '../../components/CalculationDecisionPanel.vue'
import AlertStack from '../../components/AlertStack.vue'
import { useStandardStore } from "../../store/useStandardStore";
import { calcFit } from "../../engine/tolerances/fit";
import type { FitResult } from "../../engine/types";
import { FilePdfOutlined, SaveOutlined, StarOutlined, StarTwoTone, UndoOutlined } from "@ant-design/icons-vue";
import { usePdfExport } from '../../composables/usePdfExport'
import { useActiveProject } from '../../composables/useActiveProject'
import { useWorkflowRecorder } from '../../composables/useWorkflowRecorder'
import { useAppFeedback } from '../../composables/useAppFeedback'
import { useFavorite } from '../../composables/useFavorite'
import { getReportModuleMeta } from '../../utils/reporting'
import { consumeToolLaunchPayload } from '../../utils/tool-launch'

const store = useStandardStore();
const { activeProject } = useActiveProject()
const { recordModuleCalculation } = useWorkflowRecorder()
const feedback = useAppFeedback()
const { isFavorited, toggleFavorite, checkFavorite } = useFavorite()
const reportMeta = getReportModuleMeta('tolerances')

const defaultFitState = {
    size: 25,
    holePos: "H",
    holeGrade: "IT7",
    shaftPos: "g",
    shaftGrade: "IT6",
}

const fitPresets = [
    {
        key: 'general-clearance',
        label: 'H7/g6',
        description: '通用间隙配合，兼顾定位与滑动。',
        values: { size: 25, holePos: 'H', holeGrade: 'IT7', shaftPos: 'g', shaftGrade: 'IT6' },
    },
    {
        key: 'close-running',
        label: 'H7/f7',
        description: '间隙更稳，适合普通转动或导向。',
        values: { size: 25, holePos: 'H', holeGrade: 'IT7', shaftPos: 'f', shaftGrade: 'IT7' },
    },
    {
        key: 'locating-transition',
        label: 'H7/h6',
        description: '偏定位型，接近零间隙边界。',
        values: { size: 25, holePos: 'H', holeGrade: 'IT7', shaftPos: 'h', shaftGrade: 'IT6' },
    },
    {
        key: 'rough-clearance',
        label: 'H8/f7',
        description: '制造更宽松，适合一般装配筛查。',
        values: { size: 40, holePos: 'H', holeGrade: 'IT8', shaftPos: 'f', shaftGrade: 'IT7' },
    },
] as const

function parseBandCode(input: unknown) {
    const normalized = String(input ?? "").trim()
    const matched = normalized.match(/^([A-Za-z]+)\s*([0-9]{1,2})$/)
    if (!matched) return null

    return {
        pos: matched[1].charAt(0),
        grade: `IT${matched[2]}`,
    }
}

function applyLaunchedFitPayload(payload: unknown) {
    if (!payload || typeof payload !== "object") return false

    const record = payload as Record<string, unknown>
    let applied = false

    const nextSize = Number(record.size)
    if (Number.isFinite(nextSize) && nextSize > 0) {
        size.value = nextSize
        applied = true
    }

    const holeBand = parseBandCode(record.hole)
    const shaftBand = parseBandCode(record.shaft)
    const nextHolePos = typeof record.holePos === "string" ? record.holePos : holeBand?.pos
    const nextHoleGrade = typeof record.holeGrade === "string" ? record.holeGrade : holeBand?.grade
    const nextShaftPos = typeof record.shaftPos === "string" ? record.shaftPos : shaftBand?.pos
    const nextShaftGrade = typeof record.shaftGrade === "string" ? record.shaftGrade : shaftBand?.grade

    if (nextHolePos) {
        holePos.value = nextHolePos
        applied = true
    }
    if (nextHoleGrade) {
        holeGrade.value = nextHoleGrade
        applied = true
    }
    if (nextShaftPos) {
        shaftPos.value = nextShaftPos
        applied = true
    }
    if (nextShaftGrade) {
        shaftGrade.value = nextShaftGrade
        applied = true
    }

    if (applied) {
        activeFormulaSection.value = 'ISO 286 公差带换算'
    }

    return applied
}

// 表单输入
const size = ref<number>(defaultFitState.size);
const holePos = ref(defaultFitState.holePos);
const holeGrade = ref(defaultFitState.holeGrade);
const shaftPos = ref(defaultFitState.shaftPos);
const shaftGrade = ref(defaultFitState.shaftGrade);

const holePositions = ["H"];
const shaftPositions = ["h", "g", "f"];
const itGrades = ["IT5", "IT6", "IT7", "IT8", "IT9"];

// 计算结果
const fitResult = ref<FitResult | null>(null);

watchEffect(() => {
    if (!size.value || size.value <= 0) {
        fitResult.value = null;
        return;
    }

    const sizeIndex = store.getSizeRangeIndex(size.value);
    if (sizeIndex === -1) {
        fitResult.value = null;
        return;
    }

    const [holeIT, holeDev, shaftIT, shaftDev] = [
        store.getITValue(holeGrade.value, sizeIndex),
        store.getFundamentalDeviation("holes", holePos.value, sizeIndex),
        store.getITValue(shaftGrade.value, sizeIndex),
        store.getFundamentalDeviation("shafts", shaftPos.value, sizeIndex),
    ];

    if (
        holeIT === null ||
        holeDev === null ||
        shaftIT === null ||
        shaftDev === null
    ) {
        fitResult.value = null;
        return;
    }

    const holeES = holeDev + holeIT;
    const holeEI = holeDev;
    const shaftes = shaftDev;
    const shaftei = shaftDev - shaftIT;

    const result = calcFit(size.value, holeES / 1000, holeEI / 1000, shaftes / 1000, shaftei / 1000);
    result.fit_code = `${holePos.value}${holeGrade.value.replace("IT", "")}/${shaftPos.value}${shaftGrade.value.replace("IT", "")}`;
    fitResult.value = result;
});

const getFitTypeLabel = (type: string) => {
    const map: Record<string, string> = {
        clearance: "间隙配合",
        transition: "过渡配合",
        interference: "过盈配合",
    };
    return map[type] || type;
};

const getFitTypeColor = (type: string) => {
    const map: Record<string, string> = {
        clearance: "green",
        transition: "orange",
        interference: "red",
    };
    return map[type] || "blue";
};

const { isExporting, exportPdf } = usePdfExport()
const favoriteId = computed(() => `tolerance_${size.value}_${holePos.value}${holeGrade.value}_${shaftPos.value}${shaftGrade.value}`)
const activePresetKey = computed(() => {
    const matched = fitPresets.find((preset) =>
        preset.values.size === size.value &&
        preset.values.holePos === holePos.value &&
        preset.values.holeGrade === holeGrade.value &&
        preset.values.shaftPos === shaftPos.value &&
        preset.values.shaftGrade === shaftGrade.value,
    )
    return matched?.key ?? ''
})
const projectMetrics = computed(() => {
    if (!fitResult.value) return []
    return [
        { label: '配合代号', value: fitResult.value.fit_code },
        { label: '配合类型', value: getFitTypeLabel(fitResult.value.fit_type) },
        { label: '最小间隙', value: `${(fitResult.value.min_clearance * 1000).toFixed(0)} μm` },
    ]
})
const sizeRangeSupported = computed(() => size.value > 0 && store.getSizeRangeIndex(size.value) !== -1)
const inputAlerts = computed(() => {
    const items: Array<{ message: string; description?: string; level: 'warning' | 'error' }> = []

    if (size.value <= 0) {
        items.push({
            level: 'error',
            message: '基本尺寸必须大于 0 mm。',
            description: '请输入有效名义尺寸后再判断配合类型和极限间隙。',
        })
        return items
    }

    if (!sizeRangeSupported.value) {
        items.push({
            level: 'warning',
            message: '当前尺寸超出本地 ISO 286 标准表覆盖范围。',
            description: '请把尺寸控制在本地标准表支持区间内，或补充对应标准数据后再计算。',
        })
    }

    return items
})
const resultSummaryCards = computed(() => {
    if (!fitResult.value) return []

    return [
        {
            label: '配合代号',
            value: fitResult.value.fit_code,
            hint: '当前孔轴公差带组合',
            emphasis: true,
        },
        {
            label: '配合类型',
            value: getFitTypeLabel(fitResult.value.fit_type),
            hint: fitResult.value.fit_type === 'clearance' ? '以间隙为主' : fitResult.value.fit_type === 'transition' ? '间隙与轻过盈并存' : '以过盈为主',
        },
        {
            label: '最小间隙 Xmin',
            value: `${(fitResult.value.min_clearance * 1000).toFixed(0)} μm`,
            hint: '最严苛装配边界',
        },
        {
            label: '最大间隙 Xmax',
            value: `${(fitResult.value.max_clearance * 1000).toFixed(0)} μm`,
            hint: '最宽松运行边界',
        },
    ]
})
const emptyDescription = computed(() => {
    if (size.value <= 0) return '请输入有效基本尺寸'
    if (!sizeRangeSupported.value) return '当前尺寸超出本地标准表范围'
    return '当前组合暂无可用结果'
})
const decisionPanel = computed(() => {
    if (!fitResult.value) return null

    const minClearanceUm = fitResult.value.min_clearance * 1000
    const maxClearanceUm = fitResult.value.max_clearance * 1000
    const fitType = fitResult.value.fit_type

    const status: 'success' | 'info' | 'warning' | 'error' = fitType === 'clearance'
        ? minClearanceUm >= 10
            ? 'success'
            : 'info'
        : fitType === 'transition'
            ? 'warning'
            : 'error'

    const risks: string[] = []
    const actions: string[] = []

    if (fitType === 'clearance' && minClearanceUm < 10) {
        risks.push(`最小间隙仅 ${minClearanceUm.toFixed(0)} μm，受制造波动影响时更容易逼近临界装配边界。`)
        actions.push('如果需要更稳妥的滑动余量，可考虑降低轴公差带或放宽孔等级。')
    }
    if (fitType === 'transition') {
        risks.push('当前为过渡配合，批量制造时可能同时出现间隙件和轻过盈件。')
        actions.push('继续前请明确装配工艺是手装、压装还是热装，并确认允许的波动区间。')
    }
    if (fitType === 'interference') {
        risks.push(`当前存在过盈，最小值约 ${Math.abs(maxClearanceUm).toFixed(0)} μm 到 ${Math.abs(minClearanceUm).toFixed(0)} μm。`)
        actions.push('请进一步校核压装力、装配温差、壁厚与拆装要求，不要只凭配合代号定型。')
    }
    if (maxClearanceUm > 80) {
        risks.push(`最大间隙达到 ${maxClearanceUm.toFixed(0)} μm，运行间隙可能偏大。`)
        actions.push('如果该配合用于定位或低振动传动，建议收紧孔或轴公差。')
    }

    return {
        conclusion: `${fitResult.value.fit_code} 当前判定为${getFitTypeLabel(fitType)}，Xmin ${minClearanceUm.toFixed(0)} μm，Xmax ${maxClearanceUm.toFixed(0)} μm。`,
        status,
        risks,
        actions,
        boundaries: [
            '当前页面基于 ISO 286 本地标准表做孔轴公差带换算。',
            '这里只给出极限间隙/过盈筛查，不包含装配力、表面粗糙度和热配工艺校核。',
        ],
    }
})
const formulaSections = computed(() => {
    const typeNote = fitResult.value?.fit_type === 'clearance'
        ? '间隙配合判据: Xmin ≥ 0'
        : fitResult.value?.fit_type === 'interference'
          ? '过盈配合判据: Xmax ≤ 0'
          : '过渡配合判据: Xmax > 0 且 Xmin < 0';

    return [
        {
            title: 'ISO 286 公差带换算',
            formulas: [
                'ES = EI + IT',
                'es = 基本偏差',
                'ei = es - IT',
            ],
            variables: ['IT: 标准公差值', 'EI/ES: 孔偏差', 'ei/es: 轴偏差'],
            notes: ['当前页面按孔基制 H 和常用轴偏差 h/g/f 查询本地标准表。'],
        },
        {
            title: '配合间隙/过盈',
            formulas: [
                'Xmax = ES - ei',
                'Xmin = EI - es',
            ],
            variables: ['X > 0 表示间隙', 'X < 0 表示过盈'],
            notes: [typeNote],
        },
    ];
});
const activeFormulaSection = ref('ISO 286 公差带换算')

watch(favoriteId, (id) => {
    checkFavorite(id)
}, { immediate: true })

onMounted(() => {
    const launch = consumeToolLaunchPayload('tolerances')
    if (!launch) return

    if (applyLaunchedFitPayload(launch.payload)) {
        feedback.info(`已恢复${launch.sourceLabel ?? '上次'}参数`)
    }
})

function applyFitPreset(presetKey: string) {
    const preset = fitPresets.find((item) => item.key === presetKey)
    if (!preset) return

    size.value = preset.values.size
    holePos.value = preset.values.holePos
    holeGrade.value = preset.values.holeGrade
    shaftPos.value = preset.values.shaftPos
    shaftGrade.value = preset.values.shaftGrade
}

function resetFitState() {
    size.value = defaultFitState.size
    holePos.value = defaultFitState.holePos
    holeGrade.value = defaultFitState.holeGrade
    shaftPos.value = defaultFitState.shaftPos
    shaftGrade.value = defaultFitState.shaftGrade
    activeFormulaSection.value = 'ISO 286 公差带换算'
}

function handleToggleFavorite() {
    if (!fitResult.value) return

    toggleFavorite(favoriteId.value, {
        module: 'tolerances',
        name: `配合 ${fitResult.value.fit_code}`,
        data: {
            size: size.value,
            holePos: holePos.value,
            holeGrade: holeGrade.value,
            shaftPos: shaftPos.value,
            shaftGrade: shaftGrade.value,
            result: fitResult.value,
        },
    })
}

async function handleExportPdf() {
    await exportPdf({
        selector: '.tolerances-page',
        filename: `MechBox-Tolerance-${fitResult.value?.fit_code || "fit"}`,
        reportRecord: fitResult.value
            ? {
                title: `公差配合 ${fitResult.value.fit_code} 计算书`,
                module: 'tolerances',
                projectNumber: activeProject.value?.id ?? fitResult.value.fit_code,
                projectId: activeProject.value?.id,
                projectName: activeProject.value?.name,
                standardRef: reportMeta.standardRef,
                author: '系统',
                summary: buildProjectSummary(),
            }
            : undefined,
        onSuccess: () => {
            feedback.notifyExported('公差配合 PDF')
        },
    })
}

function buildProjectSummary() {
    if (!fitResult.value) return '公差配合结果尚未形成。'
    return `配合 ${fitResult.value.fit_code}：${getFitTypeLabel(fitResult.value.fit_type)}，Xmax ${(fitResult.value.max_clearance * 1000).toFixed(0)} μm，Xmin ${(fitResult.value.min_clearance * 1000).toFixed(0)} μm。`
}

async function syncToProject() {
    if (!fitResult.value) {
        feedback.warning('当前结果尚未形成，无法写入项目')
        return
    }
    if (!activeProject.value) {
        feedback.warning('当前没有活动项目，无法写入摘要')
        return
    }

    await recordModuleCalculation({
        module: 'tolerances',
        name: `配合 ${fitResult.value.fit_code}`,
        projectSummary: buildProjectSummary(),
        inputData: {
            size: size.value,
            holePos: holePos.value,
            holeGrade: holeGrade.value,
            shaftPos: shaftPos.value,
            shaftGrade: shaftGrade.value,
        },
        contextData: {
            hole: `${holePos.value}${holeGrade.value.replace('IT', '')}`,
            shaft: `${shaftPos.value}${shaftGrade.value.replace('IT', '')}`,
        },
        outputData: fitResult.value,
        recentData: {
            size: size.value,
            hole: `${holePos.value}${holeGrade.value.replace('IT', '')}`,
            shaft: `${shaftPos.value}${shaftGrade.value.replace('IT', '')}`,
            fitType: fitResult.value.fit_type,
            maxClearance: fitResult.value.max_clearance,
            minClearance: fitResult.value.min_clearance,
        },
        derivedMetrics: {
            maxClearance: fitResult.value.max_clearance,
            minClearance: fitResult.value.min_clearance,
        },
    })
    feedback.notifySaved('项目摘要')
}
</script>

<template>
    <div class="tolerances-page">
        <PageToolbar title="MechBox" subtitle="公差配合">
            <a-space>
                <a-button size="small" @click="resetFitState">
                    <template #icon><UndoOutlined /></template>恢复默认
                </a-button>
                <a-button size="small" :disabled="!fitResult" @click="syncToProject">
                    <template #icon><SaveOutlined /></template>写入项目
                </a-button>
                <a-button size="small" :disabled="!fitResult" @click="handleToggleFavorite">
                    <template #icon>
                        <StarTwoTone v-if="isFavorited" two-tone-color="#faad14" />
                        <StarOutlined v-else />
                    </template>
                    {{ isFavorited ? '已收藏' : '收藏' }}
                </a-button>
                <a-button size="small" type="primary" @click="handleExportPdf" :disabled="!fitResult || isExporting">
                    <template #icon><FilePdfOutlined /></template>导出PDF
                </a-button>
            </a-space>
        </PageToolbar>

        <div class="content-body">
            <ToolPageLayout :input-span="10" :output-span="14" :gutter="24">
                <template #side>
                    <a-card title="参数输入" size="small">
                        <a-form layout="vertical">
                            <a-form-item label="基本尺寸 (mm)">
                                <a-input-number
                                    v-model:value="size"
                                    :min="1"
                                    :max="500"
                                    style="width: 100%"
                                />
                            </a-form-item>
                            <a-divider>孔公差带</a-divider>
                            <a-row :gutter="12">
                                <a-col :span="12">
                                    <a-form-item label="基本偏差代号">
                                        <a-select
                                            v-model:value="holePos"
                                            :options="holePositions.map((v) => ({ value: v }))"
                                        />
                                    </a-form-item>
                                </a-col>
                                <a-col :span="12">
                                    <a-form-item label="公差等级">
                                        <a-select
                                            v-model:value="holeGrade"
                                            :options="itGrades.map((v) => ({ value: v }))"
                                        />
                                    </a-form-item>
                                </a-col>
                            </a-row>
                            <a-divider>轴公差带</a-divider>
                            <a-row :gutter="12">
                                <a-col :span="12">
                                    <a-form-item label="基本偏差代号">
                                        <a-select
                                            v-model:value="shaftPos"
                                            :options="shaftPositions.map((v) => ({ value: v }))"
                                        />
                                    </a-form-item>
                                </a-col>
                                <a-col :span="12">
                                    <a-form-item label="公差等级">
                                        <a-select
                                            v-model:value="shaftGrade"
                                            :options="itGrades.map((v) => ({ value: v }))"
                                        />
                                    </a-form-item>
                                </a-col>
                            </a-row>
                        </a-form>
                    </a-card>
                    <ToolPresetBar
                        title="常用配合预设"
                        description="先套一个常用配合，再按尺寸和精度细调，效率更高。"
                        :presets="fitPresets"
                        :active-key="activePresetKey"
                        @apply="applyFitPreset"
                        @reset="resetFitState"
                    />
                    <InfoPanel title="使用提示" tone="accent">
                        当前页面适合快速判断配合类型和极限间隙范围。若结果进入过渡或过盈区，请继续复核装配工艺、热装条件和定位需求。
                    </InfoPanel>
                    <ProjectContextCard
                        :active-project="activeProject"
                        current-module="tolerances"
                        current-module-label="公差配合"
                        :metrics="projectMetrics"
                        note="写入项目会把当前配合类型和极限间隙结果同步到最近计算，便于后续装配方案回看。"
                    />
                </template>

                <template #main>
                    <AlertStack v-if="inputAlerts.length" :items="inputAlerts" class="inline-validation" />
                    <a-card title="计算结果" size="small" v-if="fitResult">
                        <template #extra>
                            <a-tag :color="getFitTypeColor(fitResult.fit_type)">
                                {{ getFitTypeLabel(fitResult.fit_type) }}
                            </a-tag>
                        </template>
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
                        <a-descriptions bordered size="small" :column="2">
                            <a-descriptions-item label="配合代号" :span="2">
                                <strong>{{ fitResult.fit_code }}</strong>
                            </a-descriptions-item>
                            <a-descriptions-item label="孔上偏差 ES">
                                +{{ (fitResult.hole_upper * 1000).toFixed(0) }} μm
                            </a-descriptions-item>
                            <a-descriptions-item label="孔下偏差 EI">
                                {{ (fitResult.hole_lower * 1000).toFixed(0) }} μm
                            </a-descriptions-item>
                            <a-descriptions-item label="轴上偏差 es">
                                {{ (fitResult.shaft_upper * 1000).toFixed(0) }} μm
                            </a-descriptions-item>
                            <a-descriptions-item label="轴下偏差 ei">
                                {{ (fitResult.shaft_lower * 1000).toFixed(0) }} μm
                            </a-descriptions-item>
                            <a-descriptions-item label="最大间隙 Xmax">
                                <a-tag :color="fitResult.max_clearance >= 0 ? 'green' : 'red'">
                                    {{ (fitResult.max_clearance * 1000).toFixed(0) }} μm
                                </a-tag>
                            </a-descriptions-item>
                            <a-descriptions-item label="最小间隙 Xmin">
                                <a-tag :color="fitResult.min_clearance >= 0 ? 'green' : 'red'">
                                    {{ (fitResult.min_clearance * 1000).toFixed(0) }} μm
                                </a-tag>
                            </a-descriptions-item>
                        </a-descriptions>
                        <div class="section-actions">
                            <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === 'ISO 286 公差带换算' }" @click="activeFormulaSection = 'ISO 286 公差带换算'">查看公差换算</button>
                            <button type="button" class="formula-jump" :class="{ 'is-active': activeFormulaSection === '配合间隙/过盈' }" @click="activeFormulaSection = '配合间隙/过盈'">查看间隙判据</button>
                        </div>
                    </a-card>
                    <CalculationDecisionPanel
                        v-if="decisionPanel"
                        title="配合判断"
                        :conclusion="decisionPanel.conclusion"
                        :status="decisionPanel.status"
                        :risks="decisionPanel.risks"
                        :actions="decisionPanel.actions"
                        :boundaries="decisionPanel.boundaries"
                    />
                    <FormulaPanel v-if="fitResult" v-model:activeSection="activeFormulaSection" :sections="formulaSections" />
                    <a-empty v-else :description="emptyDescription" />
                </template>
            </ToolPageLayout>
        </div>
    </div>
</template>

<style scoped>
/* 使用全局统一样式 components.css */
</style>
