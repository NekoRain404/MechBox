export const TOOL_LAUNCH_STORAGE_KEY = "mechbox-tool-launch-payloads";

export interface ToolLaunchRecord {
  module: string
  payload: unknown
  sourceLabel?: string
  createdAt: number
}

type ToolLaunchMap = Record<string, ToolLaunchRecord>

function loadToolLaunchMap(): ToolLaunchMap {
  if (typeof sessionStorage === "undefined") {
    return {}
  }

  try {
    const raw = sessionStorage.getItem(TOOL_LAUNCH_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ToolLaunchMap
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch (_error) {
    return {}
  }
}

function saveToolLaunchMap(records: ToolLaunchMap): void {
  if (typeof sessionStorage === "undefined") {
    return
  }

  sessionStorage.setItem(TOOL_LAUNCH_STORAGE_KEY, JSON.stringify(records))
}

export function stageToolLaunchPayload(module: string, payload: unknown, sourceLabel?: string): void {
  if (!module) return

  const records = loadToolLaunchMap()
  records[module] = {
    module,
    payload,
    sourceLabel,
    createdAt: Date.now(),
  }
  saveToolLaunchMap(records)
}

export function consumeToolLaunchPayload(module: string): ToolLaunchRecord | null {
  if (!module) return null

  const records = loadToolLaunchMap()
  const record = records[module]
  if (!record) return null

  delete records[module]
  saveToolLaunchMap(records)
  return record
}
