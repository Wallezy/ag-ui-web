import { Fragment } from 'react'
import {
  AlertTriangle,
  Bug,
  CalendarClock,
  CheckCircle2,
  Clock3,
  CornerDownRight,
  FileText,
  HelpCircle,
  Hourglass,
  ListTodo,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  dailyReportLineWorkItemKey,
  isEditableDailyReportWorkText,
  overdueReasonTitle,
  type DailyReportLine,
  type DailyReportSection,
  type DailyReportSectionKind,
  type OverdueLineMatches,
  type OverdueReasonItem,
} from './daily-report-model'
import { formatNumber } from './shared'
import { formatOptionalPercent } from './work-hour-form-model'

export function DailyReportSectionView({
  section,
  overdueMatches,
  overdueReasons,
  disabled,
  onReasonChange,
}: {
  section: DailyReportSection
  overdueMatches: OverdueLineMatches
  overdueReasons: Record<string, string>
  disabled: boolean
  onReasonChange: (key: string, value: string) => void
}) {
  return (
    <section className='px-3 py-3'>
      <div className='mb-3 flex items-center gap-2'>
        <DailyReportSectionIcon
          kind={section.kind}
          className={dailyReportSectionIconClass(section.kind)}
        />
        <h3 className='text-sm font-medium'>{section.title}</h3>
        {section.items.length ? (
          <>
            <span className='text-muted-foreground text-xs' aria-hidden='true'>
              ·
            </span>
            <span className='text-muted-foreground text-xs'>
              {section.items.length} 项
            </span>
          </>
        ) : null}
      </div>

      {section.items.length ? (
        isDailyReportWorkSection(section.kind) ? (
          <DailyReportWorkTable
            section={section}
            overdueMatches={overdueMatches}
            overdueReasons={overdueReasons}
            disabled={disabled}
            onReasonChange={onReasonChange}
          />
        ) : (
          <div className='flex flex-col gap-1.5'>
            {section.items.map((line) => {
              const overdueItem = overdueMatches.byLineId.get(line.id)
              return (
                <DailyReportLineView
                  key={line.id}
                  line={line}
                  kind={section.kind}
                  overdueItem={overdueItem}
                  overdueReason={
                    overdueItem ? (overdueReasons[overdueItem.key] ?? '') : ''
                  }
                  disabled={disabled}
                  onReasonChange={(value) => {
                    if (overdueItem) onReasonChange(overdueItem.key, value)
                  }}
                />
              )
            })}
          </div>
        )
      ) : (
        <div className='text-muted-foreground rounded-md border border-dashed px-3 py-3 text-sm'>
          暂无
        </div>
      )}
    </section>
  )
}

function DailyReportWorkTable({
  section,
  overdueMatches,
  overdueReasons,
  disabled,
  onReasonChange,
}: {
  section: DailyReportSection
  overdueMatches: OverdueLineMatches
  overdueReasons: Record<string, string>
  disabled: boolean
  onReasonChange: (key: string, value: string) => void
}) {
  return (
    <div className='bg-muted/30 flex flex-col gap-2 rounded-lg border p-2'>
      {section.items.map((line) => {
        const overdueItem = overdueMatches.byLineId.get(line.id)
        const canEditWorkText = isEditableDailyReportWorkText(
          line,
          section.kind,
          overdueItem
        )
        const workTextKey = canEditWorkText
          ? (overdueItem?.key ?? dailyReportLineWorkItemKey(line, section.kind))
          : undefined
        const hasWorkTextDraft = workTextKey
          ? Object.prototype.hasOwnProperty.call(overdueReasons, workTextKey)
          : false
        const workTextValue =
          workTextKey && hasWorkTextDraft
            ? (overdueReasons[workTextKey] ?? '')
            : line.executionText || line.detail || ''
        return (
          <DailyReportWorkTableRow
            key={line.id}
            line={line}
            kind={section.kind}
            overdueItem={overdueItem}
            workTextKey={workTextKey}
            workTextValue={workTextValue}
            canEditWorkText={canEditWorkText}
            disabled={disabled}
            onWorkTextChange={(value) => {
              if (workTextKey) onReasonChange(workTextKey, value)
            }}
          />
        )
      })}
    </div>
  )
}

function DailyReportWorkTableRow({
  line,
  kind,
  overdueItem,
  workTextKey,
  workTextValue,
  canEditWorkText,
  disabled,
  onWorkTextChange,
}: {
  line: DailyReportLine
  kind: DailyReportSectionKind
  overdueItem?: OverdueReasonItem
  workTextKey?: string
  workTextValue: string
  canEditWorkText: boolean
  disabled: boolean
  onWorkTextChange: (value: string) => void
}) {
  const hasOverdueFlag =
    Boolean(overdueItem) ||
    (line.overdueDays !== undefined && line.overdueDays > 0)
  const isDueToday =
    line.overdueDays === 0 &&
    (kind === 'tasks' || (kind === 'bugs' && line.status === '激活'))
  const isMissingReason = canEditWorkText && !workTextValue.trim() && !disabled
  const metrics = dailyReportWorkMetrics(line, kind)
  const showWorkText = kind !== 'plan'

  return (
    <div
      className={cn(
        'rounded-lg border p-3 text-sm transition-colors',
        'border-border bg-background hover:border-primary/30'
      )}
    >
      <div className='flex min-w-0 flex-col gap-2'>
        <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
          <div className='flex min-w-0 flex-1 items-center gap-2'>
            <Badge
              variant='secondary'
              className='text-muted-foreground max-w-36 justify-start truncate font-normal'
              title={line.project || '-'}
            >
              {line.project || '-'}
            </Badge>
            <span
              className='min-w-0 flex-1 truncate font-medium'
              title={line.title}
            >
              {line.title || '-'}
            </span>
          </div>
          <div className='flex shrink-0 flex-wrap items-center gap-1.5'>
            {line.status ? (
              <Badge
                variant='outline'
                className={cn(
                  'font-normal',
                  statusToneClass(line.status, kind)
                )}
              >
                {line.status}
              </Badge>
            ) : (
              <Badge
                variant='outline'
                className='text-muted-foreground font-normal'
              >
                -
              </Badge>
            )}
            {hasOverdueFlag ? (
              <Badge
                variant='outline'
                className='border-destructive/30 bg-destructive/10 text-destructive'
              >
                {line.status === '已解决' ? '等待' : '逾期'}{' '}
                {formatNumber(
                  overdueItem?.overdueDays ?? line.overdueDays ?? 0,
                  0
                )}{' '}
                天
              </Badge>
            ) : null}
            {isDueToday ? (
              <Badge
                variant='outline'
                className='border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
              >
                今天到期
              </Badge>
            ) : null}
          </div>
        </div>

        <div
          className={cn(
            'flex min-w-0 flex-col gap-2 rounded-md border px-2 py-2 sm:flex-row sm:items-center sm:justify-between',
            'border-border/70 bg-muted/30'
          )}
        >
          <div className='flex min-w-0 flex-wrap items-center gap-2 text-xs'>
            {metrics.map((metric, index) => (
              <Fragment key={metric.label}>
                {index > 0 ? (
                  <Separator
                    orientation='vertical'
                    className='hidden h-4 sm:block'
                  />
                ) : null}
                <DailyReportInlineMetric
                  label={metric.label}
                  value={metric.value}
                />
              </Fragment>
            ))}
          </div>

          {showWorkText ? (
            <div className='flex min-w-0 flex-1 items-center gap-2 sm:max-w-80'>
              <span
                className={cn(
                  'shrink-0 text-xs',
                  isMissingReason ? 'text-destructive' : 'text-muted-foreground'
                )}
              >
                {canEditWorkText ? '逾期原因' : '执行情况'}
              </span>
              {canEditWorkText && workTextKey ? (
                <Input
                  value={workTextValue}
                  onChange={(event) => onWorkTextChange(event.target.value)}
                  disabled={disabled}
                  aria-invalid={isMissingReason}
                  placeholder='请填写逾期原因'
                  className='bg-background h-7 px-2 text-xs'
                />
              ) : (
                <div
                  className='text-muted-foreground bg-background min-w-0 flex-1 truncate rounded-md border px-2 py-1 text-xs'
                  title={workTextValue || '-'}
                >
                  {workTextValue || '-'}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function dailyReportWorkMetrics(
  line: DailyReportLine,
  kind: DailyReportSectionKind
) {
  if (kind === 'plan') {
    return [{ label: '初始进度', value: formatOptionalPercent(line.progress) }]
  }
  if (kind === 'bugs') {
    return [
      { label: '完成进度', value: formatOptionalPercent(line.progress) },
      { label: '耗时', value: line.hours || '-' },
    ]
  }
  return [
    { label: '总体进度', value: formatOptionalPercent(line.progress) },
    ...(kind === 'tasks'
      ? [
          {
            label: '个人进度',
            value: formatOptionalPercent(line.personalProgress),
          },
        ]
      : []),
    { label: '耗时', value: line.hours || '-' },
  ]
}

function DailyReportInlineMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  const isEmpty = !value || value === '-'

  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      <span className='text-muted-foreground shrink-0'>{label}</span>
      <span
        className={cn(
          'truncate font-medium',
          isEmpty && 'text-muted-foreground font-normal'
        )}
      >
        {value || '-'}
      </span>
    </div>
  )
}

function isDailyReportWorkSection(kind: DailyReportSectionKind) {
  return kind === 'tasks' || kind === 'bugs' || kind === 'plan'
}

function DailyReportLineView({
  line,
  kind,
  overdueItem,
  overdueReason,
  disabled,
  onReasonChange,
}: {
  line: DailyReportLine
  kind: DailyReportSectionKind
  overdueItem?: OverdueReasonItem
  overdueReason: string
  disabled: boolean
  onReasonChange: (value: string) => void
}) {
  const isOverdue = Boolean(overdueItem)
  const hasOverdueFlag =
    isOverdue || (line.overdueDays !== undefined && line.overdueDays > 0)
  const isDueToday =
    line.overdueDays === 0 &&
    (kind === 'tasks' || (kind === 'bugs' && line.status === '激活'))
  const isMissingReason = isOverdue && !overdueReason.trim() && !disabled

  if (line.summary) {
    return (
      <div className='text-muted-foreground bg-muted/30 rounded-md px-2.5 py-1.5 text-xs'>
        {line.text}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border px-2.5 py-2 text-sm',
        hasOverdueFlag
          ? 'border-destructive/25 bg-destructive/5'
          : 'border-border/70 bg-background'
      )}
    >
      <div className='flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          {hasOverdueFlag ? (
            <Badge
              variant='outline'
              className='border-destructive/30 bg-destructive/10 text-destructive'
            >
              {line.status === '已解决' ? '等待' : '逾期'}{' '}
              {formatNumber(
                overdueItem?.overdueDays ?? line.overdueDays ?? 0,
                0
              )}{' '}
              天
            </Badge>
          ) : null}
          {isDueToday ? (
            <Badge
              variant='outline'
              className='border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
            >
              今天到期
            </Badge>
          ) : null}
          {line.project ? (
            <span
              className='text-muted-foreground max-w-32 shrink-0 truncate text-xs'
              title={line.project}
            >
              {line.project}
            </span>
          ) : null}
          <span
            className='min-w-0 flex-1 truncate font-medium'
            title={line.title}
          >
            {line.title}
          </span>
          {line.status ? (
            <Badge
              variant='outline'
              className={cn('font-normal', statusToneClass(line.status, kind))}
            >
              {line.status}
            </Badge>
          ) : null}
        </div>

        {line.progress !== undefined ||
        line.personalProgress !== undefined ||
        line.hours ? (
          <div className='flex shrink-0 items-center gap-2 sm:min-w-36'>
            {line.progress !== undefined ? (
              <div className='bg-muted h-1.5 w-20 overflow-hidden rounded-full'>
                <div
                  className={cn(
                    'h-full rounded-full',
                    kind === 'bugs' ? 'bg-destructive' : 'bg-primary'
                  )}
                  style={{ width: `${clampPercentage(line.progress)}%` }}
                />
              </div>
            ) : null}
            {line.progress !== undefined ? (
              <span className='text-muted-foreground w-9 text-right text-xs whitespace-nowrap'>
                {formatNumber(line.progress, 0)}%
              </span>
            ) : null}
            {line.personalProgress !== undefined ? (
              <span className='text-muted-foreground text-xs whitespace-nowrap'>
                个人进度 {formatNumber(line.personalProgress, 0)}%
              </span>
            ) : null}
            {line.hours ? (
              <span className='text-muted-foreground text-xs whitespace-nowrap'>
                {line.hours}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {line.detail ? (
        <div className='text-muted-foreground mt-1 truncate text-xs'>
          {line.detail}
        </div>
      ) : null}

      {overdueItem ? (
        <div className='mt-2 flex items-center gap-2'>
          <CornerDownRight className='text-destructive/70 size-4 shrink-0' />
          <Input
            value={overdueReason}
            onChange={(event) => onReasonChange(event.target.value)}
            disabled={disabled}
            aria-invalid={isMissingReason}
            placeholder='此项已逾期，请简述原因'
            className='bg-background h-8 text-sm'
          />
        </div>
      ) : null}
    </div>
  )
}

export function OverdueReasonInput({
  item,
  value,
  disabled,
  onChange,
}: {
  item: OverdueReasonItem
  value: string
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label className='border-destructive/20 bg-background flex flex-col gap-2 rounded-md border px-3 py-3'>
      <div className='flex min-w-0 flex-wrap items-center gap-2'>
        <span className='truncate font-medium'>{overdueReasonTitle(item)}</span>
        <Badge variant='outline'>{item.typeName}</Badge>
        {item.overdueDays !== undefined ? (
          <Badge
            variant='outline'
            className='border-destructive/30 bg-destructive/10 text-destructive'
          >
            逾期 {formatNumber(item.overdueDays, 0)} 天
          </Badge>
        ) : null}
      </div>
      {item.projectTitle ? (
        <div className='text-muted-foreground truncate text-xs'>
          {item.projectTitle}
        </div>
      ) : null}
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-invalid={!value.trim() && !disabled}
        placeholder='请输入逾期原因'
      />
    </label>
  )
}

export function DailyReportSummaryCards({
  workDate,
  workHourStats,
  statusText,
  hasSubmitted,
  hasValidationProblem,
}: {
  workDate: string
  workHourStats: { task: number; bug: number; total: number }
  statusText: string
  hasSubmitted: boolean
  hasValidationProblem: boolean
}) {
  const statusStyle = dailyReportStatusSummaryStyle({
    hasSubmitted,
    hasValidationProblem,
  })
  const StatusIcon = statusStyle.icon

  return (
    <div className='grid gap-3 sm:grid-cols-3'>
      <div className='bg-muted/50 flex min-w-0 flex-col justify-center rounded-lg border p-2.5'>
        <div className='mb-1.5 flex items-center gap-1.5'>
          <CalendarClock className='text-muted-foreground size-3' />
          <span className='text-muted-foreground text-[11px] font-medium'>
            工作日期
          </span>
        </div>
        <div className='truncate text-base leading-none font-semibold'>
          {workDate}
        </div>
      </div>

      <div className='border-primary/20 bg-primary/5 hover:border-primary/30 flex min-w-0 flex-col justify-center rounded-lg border p-2.5 shadow-xs transition-colors'>
        <div className='mb-1.5 flex items-center gap-1.5'>
          <Clock3 className='text-primary size-3' />
          <span className='text-primary text-[11px] font-medium'>
            今日已填工时
          </span>
        </div>
        <div className='mb-1.5 flex items-baseline gap-1'>
          <span className='text-primary text-lg leading-none font-bold'>
            {formatNumber(workHourStats.total)}
          </span>
          <span className='text-primary/70 text-xs font-medium'>小时</span>
        </div>
        <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-[10px]'>
          <span className='flex items-center gap-1'>
            <span className='bg-primary size-1.5 rounded-full' />
            任务 {formatNumber(workHourStats.task)}h
          </span>
          <span className='flex items-center gap-1'>
            <span className='size-1.5 rounded-full bg-green-500' />
            缺陷 {formatNumber(workHourStats.bug)}h
          </span>
        </div>
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-col justify-center rounded-lg border p-2.5',
          statusStyle.cardClass
        )}
      >
        <div className='mb-1.5 flex items-center gap-1.5'>
          <StatusIcon className={cn('size-3', statusStyle.iconClass)} />
          <span
            className={cn('text-[11px] font-medium', statusStyle.labelClass)}
          >
            提交状态
          </span>
        </div>
        <div className='flex min-w-0 items-baseline'>
          <span
            className={cn(
              'rounded-md border px-2 py-0.5 text-xs font-semibold sm:text-sm',
              statusStyle.badgeClass
            )}
          >
            {statusText}
          </span>
        </div>
      </div>
    </div>
  )
}

function dailyReportStatusSummaryStyle({
  hasSubmitted,
  hasValidationProblem,
}: {
  hasSubmitted: boolean
  hasValidationProblem: boolean
}) {
  if (hasSubmitted) {
    return {
      icon: CheckCircle2,
      cardClass: 'border-green-500/20 bg-green-500/5',
      iconClass: 'text-green-600 dark:text-green-300',
      labelClass: 'text-green-700/80 dark:text-green-300',
      badgeClass:
        'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
    }
  }
  if (hasValidationProblem) {
    return {
      icon: AlertTriangle,
      cardClass: 'border-destructive/20 bg-destructive/5',
      iconClass: 'text-destructive',
      labelClass: 'text-destructive/80',
      badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
    }
  }
  return {
    icon: Hourglass,
    cardClass: 'border-amber-500/20 bg-amber-500/5',
    iconClass: 'text-amber-600 dark:text-amber-300',
    labelClass: 'text-amber-700/80 dark:text-amber-300',
    badgeClass:
      'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  }
}

function DailyReportSectionIcon({
  kind,
  className,
}: {
  kind: DailyReportSectionKind
  className?: string
}) {
  switch (kind) {
    case 'tasks':
      return <ListTodo className={className} />
    case 'bugs':
      return <Bug className={className} />
    case 'problems':
      return <HelpCircle className={className} />
    case 'risks':
      return <AlertTriangle className={className} />
    case 'plan':
      return <CalendarClock className={className} />
    default:
      return <FileText className={className} />
  }
}

function dailyReportSectionIconClass(kind: DailyReportSectionKind) {
  return cn(
    'size-4',
    kind === 'bugs' || kind === 'risks'
      ? 'text-destructive'
      : kind === 'problems'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-primary'
  )
}

function statusToneClass(status: string, kind: DailyReportSectionKind) {
  if (status.includes('已排期')) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
  }
  if (status.includes('激活') && kind === 'bugs') {
    return 'border-destructive/30 bg-destructive/10 text-destructive'
  }
  if (status.includes('进行中')) {
    return 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300'
  }
  return 'text-muted-foreground'
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value))
}
