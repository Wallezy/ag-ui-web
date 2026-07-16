import type { MissingWorkHourItem } from '../api'
import {
  formatWorkItemType,
  readBoolean,
  readNumber,
  readRecordList,
  readString,
  readText,
} from './shared'

export function readMissingWorkHourItems(
  value: unknown
): MissingWorkHourItem[] {
  return (readRecordList(value) ?? [])
    .map((item): MissingWorkHourItem | undefined => {
      const id = readText(item.id)
      const typeText = readString(item.type)
      const type =
        typeText === 'bug' ? 'bug' : typeText === 'task' ? 'task' : undefined
      const key = readText(item.key) || (id && type ? type + ':' + id : '')
      if (!id || !type || !key) return undefined
      return {
        key,
        type,
        typeName: readString(item.typeName) || formatWorkItemType(type),
        id,
        title: readString(item.title),
        projectTitle: readString(item.projectTitle),
        projectId: readText(item.projectId),
        process: readString(item.process),
        status: readString(item.status),
        workDate: readString(item.workDate),
        currentWorkHour: readNumber(item.currentWorkHour),
        progress: readNumber(item.progress),
        executionId: readText(item.executionId),
        operationMode:
          item.operationMode === 'edit'
            ? 'edit'
            : item.operationMode === 'create'
              ? 'create'
              : undefined,
        overdueDays: readNumber(item.overdueDays),
        canQuickFill: readBoolean(item.canQuickFill),
        reason: readString(item.reason),
      }
    })
    .filter((item): item is MissingWorkHourItem => Boolean(item))
}
