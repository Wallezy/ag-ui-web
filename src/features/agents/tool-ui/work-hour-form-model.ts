import type { MissingWorkHourItem, WorkHourOptionsResponse } from '../api'
import { isAllowedWorkHourDate, workHourLimits } from '../work-hour'
import {
  formatNumber,
  numberValue,
  readNumber,
  readString,
  readText,
} from './shared'

export type WorkHourFormState = {
  workDate: string
  workCategory: string
  workHour: string
  progress: string
  description: string
  evidenceMode: 'select' | 'create'
  selectedEvidenceIds: string[]
  evidences: WorkHourEvidenceDraft[]
}

export type WorkHourEvidenceDraft = {
  clientId: string
  evidenceType: '0' | '1'
  evidenceName: string
  designId: string
  projectBaseIds: string[]
  remark: string
}

export function initialWorkHourForm(
  item: MissingWorkHourItem | undefined,
  options: WorkHourOptionsResponse | null,
  fallbackWorkDate?: string
): WorkHourFormState {
  const existing = options?.existingExecution
  const limits = workHourLimits(options, item?.type ?? 'task')
  const workCategory =
    readString(existing?.workCategory) ||
    options?.defaultWorkCategory ||
    options?.workCategories.find((option) => !option.disabled)?.value ||
    ''
  const existingProgress =
    readNumber(existing?.personalProgress) ??
    readNumber(existing?.workItemProgress)
  const progress =
    existingProgress ??
    (item?.progress && item.progress > 0 ? item.progress : 1)
  const existingWorkHour = readNumber(existing?.workHour)
  const existingEvidenceIds =
    options?.evidences
      .map((evidence) => readText(evidence.id) ?? '')
      .filter(Boolean) ?? []
  const hasExistingEvidences = existingEvidenceIds.length > 0

  return {
    workDate:
      options?.workDate ||
      readString(existing?.workDate) ||
      item?.workDate ||
      fallbackWorkDate ||
      todayText(),
    workCategory,
    workHour: existingWorkHour === undefined ? '' : String(existingWorkHour),
    progress: String(
      Math.min(
        limits.progressMax,
        Math.max(
          limits.progressMin,
          limits.progressInteger ? Math.round(progress) : progress
        )
      )
    ),
    description:
      item?.type === 'task'
        ? readString(existing?.executionDesc) ||
          readString(existing?.description) ||
          ''
        : readString(existing?.description) ||
          readString(existing?.executionDesc) ||
          '',
    evidenceMode: hasExistingEvidences ? 'select' : 'create',
    selectedEvidenceIds: existingEvidenceIds,
    evidences: hasExistingEvidences ? [] : [createEvidenceDraft()],
  }
}

export function validateWorkHourForm(
  item: MissingWorkHourItem,
  form: WorkHourFormState,
  options: WorkHourOptionsResponse
) {
  const workHour = Number(form.workHour)
  const progress = Number(form.progress)
  const limits = workHourLimits(options, item.type)
  if (!form.workDate) return '请选择工作日期'
  if (!isAllowedWorkHourDate(options, form.workDate)) {
    return '这个日期当前不能登记工时，请从可选日期中重新选择。'
  }
  if (!form.workCategory) return '请选择工作类型'
  if (!form.workHour.trim()) return '请填写实际工时'
  if (
    !Number.isFinite(workHour) ||
    workHour < limits.min ||
    (limits.max !== undefined && workHour > limits.max)
  ) {
    return limits.max === undefined
      ? `工时不能小于 ${formatNumber(limits.min)} 小时`
      : `工时需在 ${formatNumber(limits.min)} 到 ${formatNumber(limits.max)} 小时之间`
  }
  const decimalPlaces = Math.max(0, Math.round(Math.log10(1 / limits.step)))
  const workHourPattern = new RegExp(
    decimalPlaces === 0 ? '^\\d+$' : `^\\d+(?:\\.\\d{1,${decimalPlaces}})?$`
  )
  if (!workHourPattern.test(form.workHour)) {
    return decimalPlaces === 0
      ? '工时必须填写整数'
      : `工时最多保留 ${decimalPlaces} 位小数`
  }
  if (!form.progress.trim()) return '请填写累计进度'
  if (
    !Number.isFinite(progress) ||
    progress < limits.progressMin ||
    progress > limits.progressMax
  ) {
    return `累计进度需在 ${formatNumber(limits.progressMin)} 到 ${formatNumber(limits.progressMax)} 之间`
  }
  if (limits.progressInteger && !Number.isInteger(progress)) {
    return '累计进度必须填写整数'
  }
  if (limits.descriptionRequired && !form.description.trim()) {
    return item.type === 'task' ? '请填写任务执行情况' : '请填写缺陷处理说明'
  }
  if (form.description.trim().length > limits.descriptionMaxLength) {
    return `执行说明不能超过 ${limits.descriptionMaxLength} 个字`
  }
  if (
    item.type === 'task' &&
    limits.evidenceRequiredProgress !== undefined &&
    progress >= limits.evidenceRequiredProgress
  ) {
    if (
      form.evidenceMode === 'select' &&
      form.selectedEvidenceIds.length === 0
    ) {
      return `任务进度达到 ${formatNumber(limits.evidenceRequiredProgress)}% 时，请选择已有物证或新增物证`
    }
    if (form.evidenceMode === 'create') {
      if (form.evidences.length === 0) {
        return '请至少添加一个物证项'
      }
      const invalid = form.evidences.some((evidence) => {
        if (evidence.projectBaseIds.length === 0) return true
        if (evidence.evidenceType === '0' && !evidence.evidenceName.trim()) {
          return true
        }
        return evidence.evidenceType === '1' && !evidence.designId
      })
      if (invalid) {
        return '请完善物证信息（关联产物必填，且名称/设计项不能为空）'
      }
    }
  }
  return ''
}

export function buildEvidencePayload(
  item: MissingWorkHourItem,
  form: WorkHourFormState,
  options: WorkHourOptionsResponse
) {
  const evidenceRequiredProgress = workHourLimits(
    options,
    item.type
  ).evidenceRequiredProgress
  if (
    item.type !== 'task' ||
    evidenceRequiredProgress === undefined ||
    Number(form.progress) < evidenceRequiredProgress
  ) {
    return undefined
  }

  if (form.evidenceMode === 'select') {
    const selected = new Set(form.selectedEvidenceIds)
    return options.evidences.filter((evidence) =>
      selected.has(readText(evidence.id) ?? '')
    )
  }

  return form.evidences.map((evidence) => {
    const projectBaseIds = evidence.projectBaseIds
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id))
    if (evidence.evidenceType === '0') {
      return compactRecord({
        evidenceType: 0,
        evidenceName: evidence.evidenceName.trim(),
        remark: evidence.remark.trim(),
        projectBaseIds,
      })
    }
    return compactRecord({
      evidenceType: 1,
      designId: Number(evidence.designId),
      remark: evidence.remark.trim(),
      projectBaseIds,
    })
  })
}

export function createEvidenceDraft(): WorkHourEvidenceDraft {
  return {
    clientId:
      'evidence-' +
      Date.now().toString(36) +
      '-' +
      Math.random().toString(36).slice(2, 8),
    evidenceType: '0',
    evidenceName: '',
    designId: '',
    projectBaseIds: [],
    remark: '',
  }
}

export function updateEvidenceDraft(
  evidences: WorkHourEvidenceDraft[],
  clientId: string,
  patch: Partial<WorkHourEvidenceDraft>
) {
  return evidences.map((evidence) =>
    evidence.clientId === clientId ? { ...evidence, ...patch } : evidence
  )
}

export function groupProjectBases(projectBases: Record<string, unknown>[]) {
  const matched = new Set<string>()
  const groups = [
    {
      id: 'type-0',
      label: '发布包',
      items: projectBases.filter((base) => String(base.type) === '0'),
    },
    {
      id: 'type-2',
      label: '文档',
      items: projectBases.filter((base) => String(base.type) === '2'),
    },
  ]
    .map((group) => {
      group.items.forEach((base) => {
        const id = readText(base.id)
        if (id) matched.add(id)
      })
      return group
    })
    .filter((group) => group.items.length > 0)

  const otherItems = projectBases.filter((base) => {
    const id = readText(base.id)
    return id && !matched.has(id)
  })
  if (otherItems.length > 0) {
    groups.push({
      id: 'type-other',
      label: '其他',
      items: otherItems,
    })
  }

  return groups
}

export function toggleStringList(
  values: string[],
  value: string,
  checked: boolean
) {
  if (!value) return values
  if (checked) return Array.from(new Set([...values, value]))
  return values.filter((item) => item !== value)
}

function compactRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, child]) => {
      if (Array.isArray(child)) return child.length > 0
      return (
        child !== undefined && child !== null && String(child).trim() !== ''
      )
    })
  )
}

export function formatOptionalPercent(value?: number) {
  return value === undefined ? '-' : formatNumber(value, 0) + '%'
}

export function combinedWorkHourRecords(
  userHours: Record<string, unknown>[],
  hiddenHours: Record<string, unknown>[]
) {
  const totals = new Map<string, number>()
  for (const record of [...userHours, ...hiddenHours]) {
    const date = readText(record.date) || readText(record.workDate) || '当天'
    const hour = numberValue(record.workHour) ?? numberValue(record.hours) ?? 0
    totals.set(date, (totals.get(date) ?? 0) + hour)
  }
  return Array.from(totals.entries()).map(([date, workHour]) => ({
    date,
    workHour,
  }))
}

export function evidenceTitle(record: Record<string, unknown>) {
  return (
    readText(record.title) ||
    readText(record.evidenceName) ||
    readText(record.name) ||
    '物证 ' + (readText(record.id) || '')
  )
}

export function projectBaseTitle(record: Record<string, unknown>) {
  return (
    readText(record.softwareName) ||
    readText(record.name) ||
    readText(record.title) ||
    readText(record.versionName) ||
    '产物 ' + (readText(record.id) || '')
  )
}

function todayText() {
  return new Date().toISOString().slice(0, 10)
}
