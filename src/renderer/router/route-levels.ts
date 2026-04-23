export type CapabilityLevel = "reference" | "screening" | "engineering" | "catalog";
export type VerificationLevel =
  | "unverified"
  | "known-value"
  | "official-benchmark"
  | "regression";

interface RouteLevelMeta {
  label: string;
  color: string;
  description: string;
}

export const capabilityLevelMetaMap: Record<CapabilityLevel, RouteLevelMeta> = {
  reference: {
    label: "资料查询",
    color: "blue",
    description: "当前页面以标准、材料或规则信息查询为主，不直接替代完整设计校核。",
  },
  screening: {
    label: "筛查级",
    color: "orange",
    description: "当前结果适合方案比较和快速初筛，不应直接当作最终定型依据。",
  },
  engineering: {
    label: "工程校核级",
    color: "green",
    description: "当前结果已具备较完整的标准链或规则链，可用于工程校核，但仍需按工况复核边界。",
  },
  catalog: {
    label: "厂商目录级",
    color: "purple",
    description: "当前页面以目录、系列和规格检索为主，适合选型收敛与数据带入。",
  },
};

export const verificationLevelMetaMap: Record<VerificationLevel, RouteLevelMeta> = {
  unverified: {
    label: "未验证",
    color: "red",
    description: "当前模块尚未形成稳定的已知值或回归验证链，使用时应额外谨慎。",
  },
  "known-value": {
    label: "已知值验证",
    color: "geekblue",
    description: "当前模块已具备基础已知值验证，但回归覆盖仍不完整。",
  },
  "official-benchmark": {
    label: "官方案例对照",
    color: "cyan",
    description: "当前模块已与官方手册、公开样例或标准案例进行对照验证。",
  },
  regression: {
    label: "回归覆盖",
    color: "success",
    description: "当前模块已有自动化测试回归覆盖，改动后可快速发现结果漂移。",
  },
};

export function getCapabilityLevelMeta(level?: CapabilityLevel) {
  return level ? capabilityLevelMetaMap[level] : undefined;
}

export function getVerificationLevelMeta(level?: VerificationLevel) {
  return level ? verificationLevelMetaMap[level] : undefined;
}

export function formatRouteQualitySummary(
  capabilityLevel?: CapabilityLevel,
  verificationLevel?: VerificationLevel,
) {
  const capability = getCapabilityLevelMeta(capabilityLevel);
  const verification = getVerificationLevelMeta(verificationLevel);

  if (capability && verification) {
    return `当前模块定位为${capability.label}，验证状态为${verification.label}。`;
  }
  if (capability) {
    return `当前模块定位为${capability.label}。`;
  }
  if (verification) {
    return `当前模块验证状态为${verification.label}。`;
  }
  return "";
}
