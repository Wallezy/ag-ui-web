export function repairActionLabel(action: string) {
  const labels: Readonly<Record<string, string>> = {
    RETRY_SAME_CALL: '正在重试临时失败',
    REPAIR_ARGUMENTS: '已修正查询条件',
    SAFE_PROBE: '正在核对候选对象',
    REFRESH_CONTEXT: '已刷新会话上下文',
  }
  return labels[action] ?? '已执行受约束的修正'
}
