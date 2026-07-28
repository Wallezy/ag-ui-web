import { Plus, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MissingWorkHourItem, WorkHourOptionsResponse } from '../api'
import {
  isWorkHourDateEditable,
  workHourDateOptions,
  workHourLimits,
} from '../work-hour'
import { nativeControlClassName, textareaClassName } from './primitives'
import {
  formatDisplayValue,
  formatNumber,
  numberValue,
  readText,
} from './shared'
import {
  combinedWorkHourRecords,
  createEvidenceDraft,
  evidenceTitle,
  groupProjectBases,
  projectBaseTitle,
  toggleStringList,
  updateEvidenceDraft,
  type WorkHourEvidenceDraft,
  type WorkHourFormState,
} from './work-hour-form-model'

export function WorkHourFormFields({
  item,
  options,
  form,
  disabled,
  onWorkDateChange,
  onChange,
}: {
  item: MissingWorkHourItem
  options: WorkHourOptionsResponse | null
  form: WorkHourFormState
  disabled: boolean
  onWorkDateChange: (workDate: string) => void
  onChange: (patch: Partial<WorkHourFormState>) => void
}) {
  const limits = workHourLimits(options, item.type)
  const dateOptions = workHourDateOptions(options)
  const dateEditable = isWorkHourDateEditable(options)
  const requiresEvidence =
    item.type === 'task' &&
    limits.evidenceRequiredProgress !== undefined &&
    Number(form.progress) >= limits.evidenceRequiredProgress

  return (
    <fieldset
      disabled={disabled}
      className='flex min-w-0 flex-col gap-4 border-0 p-0'
    >
      <div className='grid gap-3 sm:grid-cols-2'>
        <label className='flex flex-col gap-1.5 text-sm font-medium'>
          工作日期
          <select
            value={form.workDate}
            disabled={disabled || !dateEditable}
            onChange={(event) => onWorkDateChange(event.target.value)}
            className={nativeControlClassName}
          >
            {dateOptions.map((dateOption) => (
              <option key={dateOption.date} value={dateOption.date}>
                {dateOption.label || dateOption.date}
              </option>
            ))}
          </select>
          {!dateEditable ? (
            <span className='text-muted-foreground text-xs font-normal'>
              这条记录的登记日期不能修改
            </span>
          ) : null}
        </label>
        <label className='flex flex-col gap-1.5 text-sm font-medium'>
          工作类型
          <select
            value={form.workCategory}
            onChange={(event) => onChange({ workCategory: event.target.value })}
            className={nativeControlClassName}
          >
            <option value=''>请选择工作类型</option>
            {(options?.workCategories ?? []).map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className='flex flex-col gap-1.5 text-sm font-medium'>
          实际工时
          <Input
            type='number'
            min={limits.min}
            max={limits.max}
            step={limits.step}
            value={form.workHour}
            onChange={(event) => onChange({ workHour: event.target.value })}
            placeholder='例如 1.5'
          />
        </label>
        <label className='flex flex-col gap-1.5 text-sm font-medium'>
          累计进度
          <Input
            type='number'
            min={limits.progressMin}
            max={limits.progressMax}
            step={limits.progressInteger ? 1 : 'any'}
            value={form.progress}
            onChange={(event) => onChange({ progress: event.target.value })}
          />
        </label>
      </div>

      <label className='flex flex-col gap-1.5 text-sm font-medium'>
        {item.type === 'task' ? '执行情况' : '处理说明'}
        <textarea
          value={form.description}
          onChange={(event) => onChange({ description: event.target.value })}
          maxLength={limits.descriptionMaxLength}
          rows={4}
          className={textareaClassName}
          placeholder={
            item.type === 'task' ? '请填写任务执行情况' : '请填写缺陷处理说明'
          }
        />
      </label>

      <WorkHourStats options={options} />

      {requiresEvidence ? (
        <TaskEvidenceFields options={options} form={form} onChange={onChange} />
      ) : null}
    </fieldset>
  )
}

function WorkHourStats({
  options,
}: {
  options: WorkHourOptionsResponse | null
}) {
  const userHours = options?.userWorkHours ?? []
  const hiddenHours = options?.hiddenWorkHours ?? []
  const totalHours = combinedWorkHourRecords(userHours, hiddenHours)
  const registeredHours = numberValue(options?.registeredWorkHours)
  const overtimeHiddenHours = numberValue(options?.overtimeHiddenWorkHours)
  const hasPolicyTotals =
    registeredHours !== undefined || overtimeHiddenHours !== undefined

  return (
    <div className='bg-muted/30 flex flex-col gap-2 rounded-md border px-3 py-3 text-xs'>
      <div className='font-medium'>当天工时参考</div>
      <div className='text-muted-foreground flex flex-col gap-1'>
        {hasPolicyTotals ? (
          <>
            <span>
              {options?.workDate} · 合计{' '}
              {formatNumber(
                (registeredHours ?? 0) + (overtimeHiddenHours ?? 0)
              )}{' '}
              小时
            </span>
            {(overtimeHiddenHours ?? 0) > 0 ? (
              <span>
                其中会议/评审 {formatNumber(overtimeHiddenHours ?? 0)} 小时
              </span>
            ) : null}
          </>
        ) : totalHours.length ? (
          totalHours.map((record) => (
            <span key={record.date}>
              {record.date} · 合计 {formatNumber(record.workHour)} 小时
            </span>
          ))
        ) : (
          <span>暂无已填执行工时</span>
        )}
      </div>
    </div>
  )
}

function TaskEvidenceFields({
  options,
  form,
  onChange,
}: {
  options: WorkHourOptionsResponse | null
  form: WorkHourFormState
  onChange: (patch: Partial<WorkHourFormState>) => void
}) {
  const evidences = options?.evidences ?? []
  const projectBases = options?.projectBases ?? []
  const designs = options?.designs ?? []
  const projectBaseGroups = groupProjectBases(projectBases)
  const evidenceRequiredProgress = workHourLimits(
    options,
    'task'
  ).evidenceRequiredProgress

  return (
    <div className='flex flex-col gap-3 rounded-md border px-3 py-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <span className='text-sm font-medium'>关联物证</span>
        <Badge variant='outline'>
          进度 {formatNumber(evidenceRequiredProgress ?? 100)}% 必填
        </Badge>
      </div>

      <div className='grid gap-2 sm:grid-cols-2'>
        {[
          ['select', '关联已有物证'],
          ['create', '新增物证'],
        ].map(([value, label]) => (
          <Button
            key={value}
            type='button'
            variant={form.evidenceMode === value ? 'default' : 'outline'}
            size='sm'
            onClick={() =>
              onChange({
                evidenceMode: value as WorkHourFormState['evidenceMode'],
                evidences:
                  value === 'create' && form.evidences.length === 0
                    ? [createEvidenceDraft()]
                    : form.evidences,
              })
            }
          >
            {label}
          </Button>
        ))}
      </div>

      {form.evidenceMode === 'select' ? (
        <div className='flex flex-col gap-2'>
          {evidences.length ? (
            evidences.map((evidence) => {
              const id = readText(evidence.id) ?? ''
              return (
                <label
                  key={id || formatDisplayValue(evidence)}
                  className='flex items-center gap-2 rounded-md border px-3 py-2 text-sm'
                >
                  <input
                    type='checkbox'
                    checked={form.selectedEvidenceIds.includes(id)}
                    onChange={(event) =>
                      onChange({
                        selectedEvidenceIds: toggleStringList(
                          form.selectedEvidenceIds,
                          id,
                          event.target.checked
                        ),
                      })
                    }
                  />
                  <span className='min-w-0 flex-1 truncate'>
                    {evidenceTitle(evidence)}
                  </span>
                </label>
              )
            })
          ) : (
            <div className='text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm'>
              当前任务暂无已有物证，请切换到新增物证。
            </div>
          )}
        </div>
      ) : (
        <div className='flex flex-col gap-3'>
          {form.evidences.length ? (
            form.evidences.map((draft, index) => (
              <div
                key={draft.clientId}
                className='bg-muted/20 flex flex-col gap-3 rounded-md border px-3 py-3'
              >
                <div className='flex items-center justify-between gap-2'>
                  <div className='text-sm font-medium'>物证 #{index + 1}</div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='sm'
                    onClick={() =>
                      onChange({
                        evidences: form.evidences.filter(
                          (item) => item.clientId !== draft.clientId
                        ),
                      })
                    }
                  >
                    <XCircle data-icon='inline-start' />
                    删除
                  </Button>
                </div>

                <div className='grid gap-3 sm:grid-cols-2'>
                  <label className='flex flex-col gap-1.5 text-sm font-medium'>
                    物证类型
                    <select
                      value={draft.evidenceType}
                      onChange={(event) =>
                        onChange({
                          evidences: updateEvidenceDraft(
                            form.evidences,
                            draft.clientId,
                            {
                              evidenceType: event.target
                                .value as WorkHourEvidenceDraft['evidenceType'],
                              evidenceName: '',
                              designId: '',
                            }
                          ),
                        })
                      }
                      className={nativeControlClassName}
                    >
                      <option value='0'>自定义</option>
                      <option value='1'>设计</option>
                    </select>
                  </label>

                  <label className='flex flex-col gap-1.5 text-sm font-medium'>
                    备注
                    <Input
                      value={draft.remark}
                      onChange={(event) =>
                        onChange({
                          evidences: updateEvidenceDraft(
                            form.evidences,
                            draft.clientId,
                            { remark: event.target.value }
                          ),
                        })
                      }
                      placeholder='选填'
                    />
                  </label>
                </div>

                <div className='flex flex-col gap-2'>
                  <div className='text-sm font-medium'>关联产物</div>
                  {projectBaseGroups.length ? (
                    <div className='max-h-44 overflow-auto rounded-md border p-2'>
                      <div className='flex flex-col gap-3'>
                        {projectBaseGroups.map((group) => (
                          <div key={group.id} className='flex flex-col gap-2'>
                            <div className='text-muted-foreground text-xs'>
                              {group.label}
                            </div>
                            <div className='grid gap-2 sm:grid-cols-2'>
                              {group.items.map((base) => {
                                const id = readText(base.id) ?? ''
                                return (
                                  <label
                                    key={id}
                                    className='flex items-center gap-2 text-sm'
                                  >
                                    <input
                                      type='checkbox'
                                      checked={draft.projectBaseIds.includes(
                                        id
                                      )}
                                      onChange={(event) =>
                                        onChange({
                                          evidences: updateEvidenceDraft(
                                            form.evidences,
                                            draft.clientId,
                                            {
                                              projectBaseIds: toggleStringList(
                                                draft.projectBaseIds,
                                                id,
                                                event.target.checked
                                              ),
                                            }
                                          ),
                                        })
                                      }
                                    />
                                    <span className='min-w-0 flex-1 truncate'>
                                      {projectBaseTitle(base)}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className='text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm'>
                      当前项目暂无可选产物。
                    </div>
                  )}
                </div>

                {draft.evidenceType === '0' ? (
                  <label className='flex flex-col gap-1.5 text-sm font-medium'>
                    物证内容
                    <Input
                      value={draft.evidenceName}
                      onChange={(event) =>
                        onChange({
                          evidences: updateEvidenceDraft(
                            form.evidences,
                            draft.clientId,
                            { evidenceName: event.target.value }
                          ),
                        })
                      }
                      placeholder='请输入物证名称'
                    />
                  </label>
                ) : (
                  <label className='flex flex-col gap-1.5 text-sm font-medium'>
                    物证内容
                    <select
                      value={draft.designId}
                      onChange={(event) =>
                        onChange({
                          evidences: updateEvidenceDraft(
                            form.evidences,
                            draft.clientId,
                            { designId: event.target.value }
                          ),
                        })
                      }
                      className={nativeControlClassName}
                    >
                      <option value=''>请选择设计项</option>
                      {designs.map((design) => {
                        const id = readText(design.id) ?? ''
                        return (
                          <option key={id} value={id}>
                            {readText(design.title) ||
                              readText(design.name) ||
                              id}
                          </option>
                        )
                      })}
                    </select>
                  </label>
                )}
              </div>
            ))
          ) : (
            <div className='text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm'>
              暂无新增物证项。
            </div>
          )}

          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() =>
              onChange({
                evidences: [...form.evidences, createEvidenceDraft()],
              })
            }
          >
            <Plus data-icon='inline-start' />
            添加物证项
          </Button>

          <div className='text-muted-foreground text-xs'>
            文档(SVN) 类型暂未接入，请先使用自定义或设计物证。
          </div>
        </div>
      )}
    </div>
  )
}
