import { markRaw, type Component } from "vue";
import {
    BarChartOutlined,
    BlockOutlined,
    CloudUploadOutlined,
    ColumnWidthOutlined,
    ControlOutlined,
    DashOutlined,
    DatabaseOutlined,
    ExperimentOutlined,
    FileSearchOutlined,
    FileTextOutlined,
    FolderOpenOutlined,
    FolderOutlined,
    ImportOutlined,
    InfoCircleOutlined,
    MedicineBoxOutlined,
    PercentageOutlined,
    RocketOutlined,
    SafetyOutlined,
    ScissorOutlined,
    SearchOutlined,
    SettingOutlined,
    StarOutlined,
    SwapOutlined,
    ThunderboltOutlined,
    ToolOutlined,
} from "@ant-design/icons-vue";

const icon = (component: Component) => markRaw(component) as Component;

export interface ToolNavigationItem {
    key: string;
    label: string;
    summary: string;
    icon: Component;
    keywords?: string[];
    spotlight?: boolean;
}

export interface ToolNavigationGroup {
    key: string;
    title: string;
    description: string;
    kind: "tool" | "workspace";
    icon: Component;
    children: ToolNavigationItem[];
}

export interface SystemNavigationItem {
    key: string;
    label: string;
    summary: string;
    icon: Component;
}

export const toolNavigationGroups: ToolNavigationGroup[] = [
    {
        key: "design",
        title: "基础设计",
        description: "公差、密封、轴承、螺栓",
        kind: "tool",
        icon: icon(SafetyOutlined),
        children: [
            {
                key: "tolerances",
                label: "公差配合",
                summary: "ISO 286 公差、偏差与配合判断",
                icon: icon(ColumnWidthOutlined),
                keywords: ["iso 286", "孔轴", "配合", "偏差"],
                spotlight: true,
            },
            {
                key: "tolerance-stack",
                label: "公差堆叠",
                summary: "尺寸链与累积误差快速分析",
                icon: icon(ColumnWidthOutlined),
                keywords: ["尺寸链", "stack", "误差", "统计"],
            },
            {
                key: "seals",
                label: "密封圈",
                summary: "O 形圈规格、沟槽与材料建议",
                icon: icon(BlockOutlined),
                keywords: ["o-ring", "oring", "as568", "iso 3601", "沟槽"],
                spotlight: true,
            },
            {
                key: "bearings",
                label: "轴承选型",
                summary: "寿命、载荷与目录联合筛选",
                icon: icon(SettingOutlined),
                keywords: ["bearing", "iso 281", "寿命", "载荷"],
                spotlight: true,
            },
            {
                key: "bolts",
                label: "螺栓连接",
                summary: "预紧、强度与连接可靠性校核",
                icon: icon(ToolOutlined),
                keywords: ["fastener", "预紧", "扭矩", "vdi 2230"],
                spotlight: true,
            },
        ],
    },
    {
        key: "drive",
        title: "传动计算",
        description: "齿轮、弹簧、液压、电机、轴",
        kind: "tool",
        icon: icon(ThunderboltOutlined),
        children: [
            {
                key: "drives",
                label: "传动工具",
                summary: "带传动与链传动基础计算",
                icon: icon(ThunderboltOutlined),
                keywords: ["belt", "chain", "速比", "传动"],
            },
            {
                key: "gears",
                label: "齿轮计算",
                summary: "模数、齿数与齿轮几何关系",
                icon: icon(RocketOutlined),
                keywords: ["gear", "模数", "齿数", "中心距"],
                spotlight: true,
            },
            {
                key: "springs",
                label: "弹簧计算",
                summary: "刚度、应力与失稳校核",
                icon: icon(ScissorOutlined),
                keywords: ["spring", "刚度", "剪应力", "失稳"],
            },
            {
                key: "hydraulics",
                label: "液压气动",
                summary: "推力、速度与气液压基础选型",
                icon: icon(DashOutlined),
                keywords: ["hydraulic", "pneumatic", "缸径", "流量"],
            },
            {
                key: "motors",
                label: "电机选型",
                summary: "功率、转矩与惯量比评估",
                icon: icon(ExperimentOutlined),
                keywords: ["motor", "servo", "转矩", "惯量比"],
            },
            {
                key: "shafts",
                label: "轴强度",
                summary: "弯矩、扭矩与安全系数筛查",
                icon: icon(MedicineBoxOutlined),
                keywords: ["shaft", "弯扭合成", "安全系数"],
            },
        ],
    },
    {
        key: "reference",
        title: "资料检索",
        description: "单位、材料、标准件、识别互换",
        kind: "tool",
        icon: icon(SearchOutlined),
        children: [
            {
                key: "units",
                label: "单位换算",
                summary: "工程单位快速换算与对照",
                icon: icon(SwapOutlined),
                keywords: ["unit", "换算", "长度", "压力"],
            },
            {
                key: "materials",
                label: "材料库",
                summary: "牌号、性能与材料检索",
                icon: icon(DatabaseOutlined),
                keywords: ["steel", "alloy", "材料", "牌号"],
                spotlight: true,
            },
            {
                key: "standard-parts",
                label: "标准件库",
                summary: "标准件与厂商目录查询",
                icon: icon(FileSearchOutlined),
                keywords: ["catalog", "标准件", "螺纹", "目录"],
                spotlight: true,
            },
            {
                key: "reverse-identify",
                label: "逆向识别",
                summary: "按尺寸反查候选标准规格",
                icon: icon(ExperimentOutlined),
                keywords: ["reverse", "识别", "尺寸反查"],
            },
            {
                key: "material-sub",
                label: "材料代换",
                summary: "候选材料对比与替代评估",
                icon: icon(ExperimentOutlined),
                keywords: ["substitution", "代换", "相近材料"],
            },
        ],
    },
    {
        key: "analysis",
        title: "分析自动化",
        description: "扫描、统计、制造性、诊断与输出",
        kind: "tool",
        icon: icon(BarChartOutlined),
        children: [
            {
                key: "param-scan",
                label: "参数扫描",
                summary: "批量扫描设计窗口与敏感参数",
                icon: icon(BarChartOutlined),
                keywords: ["scan", "扫描", "敏感性", "参数"],
            },
            {
                key: "monte-carlo",
                label: "随机模拟",
                summary: "良率、分布与尾部风险评估",
                icon: icon(PercentageOutlined),
                keywords: ["monte carlo", "随机", "良率", "分布"],
            },
            {
                key: "dfm",
                label: "制造性分析",
                summary: "加工、装配与可制造性检查",
                icon: icon(CloudUploadOutlined),
                keywords: ["dfm", "制造性", "装配", "工艺"],
            },
            {
                key: "failure-diag",
                label: "失效诊断",
                summary: "故障模式、症状与排查线索",
                icon: icon(FileSearchOutlined),
                keywords: ["failure", "诊断", "故障", "失效"],
            },
            {
                key: "excel-import",
                label: "结构化导入",
                summary: "CSV 模板校验与批量导入准备",
                icon: icon(ImportOutlined),
                keywords: ["csv", "import", "导入", "批量"],
            },
            {
                key: "latex-report",
                label: "计算书编制",
                summary: "把结果整理为正式计算书",
                icon: icon(FileTextOutlined),
                keywords: ["latex", "report", "计算书", "文档"],
            },
        ],
    },
];

export const workspaceNavigationGroup: ToolNavigationGroup = {
    key: "workspace",
    title: "工作区",
    description: "项目、报告、文档、收藏与 BOM",
    kind: "workspace",
    icon: icon(FolderOutlined),
    children: [
        {
            key: "projects",
            label: "项目中心",
            summary: "项目上下文、版本与工作流入口",
            icon: icon(FolderOpenOutlined),
        },
        {
            key: "reports",
            label: "报告中心",
            summary: "归档报告与输出记录管理",
            icon: icon(FileTextOutlined),
        },
        {
            key: "documents",
            label: "文档中心",
            summary: "设计文档与结构化资料管理",
            icon: icon(FileSearchOutlined),
        },
        {
            key: "favorites",
            label: "我的收藏",
            summary: "高频方案与常用计算入口",
            icon: icon(StarOutlined),
        },
        {
            key: "bom-export",
            label: "BOM 导出",
            summary: "物料汇总、导出与成本整理",
            icon: icon(FileTextOutlined),
        },
    ],
};

export const systemNavigationItems: SystemNavigationItem[] = [
    {
        key: "settings",
        label: "设置",
        summary: "主题、偏好与系统配置",
        icon: icon(ControlOutlined),
    },
    {
        key: "about",
        label: "关于",
        summary: "版本、协议与项目信息",
        icon: icon(InfoCircleOutlined),
    },
];

export function getNavigationGroupByRouteKey(routeKey: string) {
    return [...toolNavigationGroups, workspaceNavigationGroup].find((group) =>
        group.children.some((item) => item.key === routeKey),
    );
}

export function getNavigationItemByRouteKey(routeKey: string) {
    return [...toolNavigationGroups, workspaceNavigationGroup]
        .flatMap((group) => group.children)
        .find((item) => item.key === routeKey);
}

export function getNavigationSectionLabel(routeKey: string) {
    if (routeKey === "dashboard") {
        return "工具";
    }

    if (toolNavigationGroups.some((group) => group.children.some((item) => item.key === routeKey))) {
        return "工具";
    }

    if (workspaceNavigationGroup.children.some((item) => item.key === routeKey)) {
        return "工作区";
    }

    if (systemNavigationItems.some((item) => item.key === routeKey)) {
        return "系统";
    }

    return "页面";
}
