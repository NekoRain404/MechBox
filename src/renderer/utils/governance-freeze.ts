export type GovernanceFreezePhase = 'working' | 'review' | 'ready' | 'frozen'

export interface GovernanceFreezeState {
  phase: GovernanceFreezePhase
  label: string
  color: string
  description: string
  isReadOnly: boolean
}

function buildFreezeState(
  phase: GovernanceFreezePhase,
  label: string,
  color: string,
  description: string,
  isReadOnly: boolean,
): GovernanceFreezeState {
  return {
    phase,
    label,
    color,
    description,
    isReadOnly,
  }
}

export function resolveWorkflowFreezeState(status?: string | null): GovernanceFreezeState {
  switch (status) {
    case 'in-review':
      return buildFreezeState('review', '评审中', 'orange', '当前仍处于审批或复核阶段，允许受控推进，但不适合当作正式发布基线。', false)
    case 'approved':
      return buildFreezeState('ready', '待发布', 'blue', '当前已完成批准，可继续进入正式发布，但仍应避免随意覆盖基线。', false)
    case 'released':
      return buildFreezeState('frozen', '发布冻结', 'green', '当前已进入正式发布态，应按只读基线处理。', true)
    case 'archived':
      return buildFreezeState('frozen', '归档基线', 'default', '当前已归档，只适合检索、比较和导出，不应继续直接编辑。', true)
    default:
      return buildFreezeState('working', '工作态', 'blue', '当前仍处于工作态，可继续整理内容和推进阶段。', false)
  }
}

export function resolveObjectFreezeState(status?: string | null): GovernanceFreezeState {
  switch (status) {
    case 'pending':
    case 'generated':
    case 'in-review':
      return buildFreezeState('review', '评审中', 'orange', '当前对象仍在生成、审批或复核链中，适合继续治理但不应当作冻结基线。', false)
    case 'approved':
      return buildFreezeState('frozen', '冻结基线', 'green', '当前对象已完成批准并进入受控冻结态，应按只读对象处理。', true)
    case 'released':
      return buildFreezeState('frozen', '发布冻结', 'green', '当前对象已进入受控冻结态，应按只读对象处理。', true)
    case 'archived':
      return buildFreezeState('frozen', '归档基线', 'default', '当前对象已归档，只适合查阅、比较和导出。', true)
    default:
      return buildFreezeState('working', '工作态', 'blue', '当前对象仍处于工作整理阶段，可以继续补齐审批与状态流转。', false)
  }
}

export function canAdvanceWorkflowStatus(status?: string | null) {
  return !resolveWorkflowFreezeState(status).isReadOnly
}

export function canDeleteWorkflowRecord(status?: string | null) {
  return !resolveWorkflowFreezeState(status).isReadOnly
}

export function canActivateProjectWorkspace(status?: string | null) {
  return !resolveWorkflowFreezeState(status).isReadOnly
}

export function canEditGovernedObject(status?: string | null) {
  return !resolveObjectFreezeState(status).isReadOnly
}
