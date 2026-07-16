import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from 'react'
import {
  useThreadRuntime,
  type ToolCallMessagePartComponent,
} from '@assistant-ui/react'
import {
  AlertTriangle,
  Bug,
  CalendarClock,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  CloudSun,
  CornerDownRight,
  Droplets,
  ExternalLink,
  FileText,
  HelpCircle,
  Hourglass,
  ListTodo,
  LoaderCircle,
  LogIn,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
  Wind,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import type { ThreadGroupPart } from '@/components/assistant-ui/thread'
import { ToolFallback } from '@/components/assistant-ui/tool-fallback'
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from '@/components/assistant-ui/tool-group'
import {
  confirmDailyReport,
  getDailyReportDraftStatus,
  getWorkHourOptions,
  redirectToOaLogin,
  saveWorkHourExecutionWithIntentRefresh,
  type DailyReportDraftStatusResponse,
  type MissingWorkHourItem,
  type WorkHourOptionsResponse,
} from './api'
import {
  dailyReportErrorMessage,
  dailyReportOperationCopy,
  dailyReportOperationMode,
  type DailyReportOperationMode,
} from './daily-report'
import { isDailyReportConfirmationAccepted } from './daily-report-confirmation'
import {
  highWorkHourConfirmation,
  highWorkHourConfirmationDetails,
  isAllowedWorkHourDate,
  isHighWorkHourConfirmationRequired,
  isWorkHourDateEditable,
  workHourDateOptions,
  workHourErrorMessage,
  workHourLimits,
} from './work-hour'
import {
  parseWorkItemsResult,
  workItemQueryPresentation,
  type WorkItemsResult,
} from './work-items-result'

type WeatherResult = {
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windGust: number
  conditions: string
  location: string
}

type OaLoginRequiredResult = {
  message: string
}

type OaToolResult = {
  toolName: string
  success?: boolean
  message?: string
  errorCode?: string
  auditId?: string
  result?: Record<string, unknown>
}

type OverdueReasonItem = {
  key: string
  type: string
  typeName: string
  id: string
  title?: string
  projectTitle?: string
  process?: string
  status?: string
  overdueDays?: number
}

type DailyReportReadinessItem = {
  code: string
  title: string
  description?: string
  action?: string
  count?: number
}

type DailyReportNextAction = {
  action: string
  label: string
}

type DailyReportReadiness = {
  status: string
  title: string
  description?: string
  blockers: DailyReportReadinessItem[]
  suggestions: DailyReportReadinessItem[]
  nextActions: DailyReportNextAction[]
}

type DailyReportReferenceSource = {
  type: string
  label: string
  count: number
}

type DailyReportReferences = {
  userContent: string[]
  oaSources: DailyReportReferenceSource[]
}

type DailyReportDraftResult = {
  draftId?: string
  draftVersion?: number
  workDate?: string
  operationMode: DailyReportOperationMode
  existingReport: boolean
  oaReportId?: string
  status?: string
  submitted?: boolean
  content: string
  remark?: string
  hasStructuredContent: boolean
  taskWork: Record<string, unknown>[]
  bugWork: Record<string, unknown>[]
  tomorrowWorkPlan: Record<string, unknown>[]
  unresolvedProblem: Record<string, unknown>[]
  unresolvedRisk: Record<string, unknown>[]
  overdueReasons?: Record<string, string>
  validationErrors: string[]
  validationWarnings: string[]
  overdueReasonItems: OverdueReasonItem[]
  missingWorkHourItems: MissingWorkHourItem[]
  readiness: DailyReportReadiness
  references: DailyReportReferences
  requiresOverdueReasons: boolean
  submitReady: boolean
  requiresConfirmation: boolean
  confirmEndpoint?: string
  idempotencyKey?: string
  confirmationContext?: Record<string, unknown>
}

type WorkHourFillActionResult = {
  workDate?: string
  items: MissingWorkHourItem[]
  confirmationContext?: Record<string, unknown>
}

type DailyReportSectionKind =
  'tasks' | 'bugs' | 'problems' | 'risks' | 'plan' | 'other'

type DailyReportLine = {
  id: string
  text: string
  body: string
  rawId?: string
  workItemType?: string
  project?: string
  title: string
  detail?: string
  progress?: number
  personalProgress?: number
  status?: string
  hours?: string
  overdueDays?: number
  executionText?: string
  summary?: boolean
}

type DailyReportSection = {
  id: string
  title: string
  kind: DailyReportSectionKind
  items: DailyReportLine[]
}

type DailyReportContent = {
  title?: string
  sections: DailyReportSection[]
}

type OverdueLineMatches = {
  byLineId: Map<string, OverdueReasonItem>
  matchedKeys: Set<string>
}

type WorkHourFormState = {
  workDate: string
  workCategory: string
  workHour: string
  progress: string
  description: string
  evidenceMode: 'select' | 'create'
  selectedEvidenceIds: string[]
  evidences: WorkHourEvidenceDraft[]
}

type WorkHourEvidenceDraft = {
  clientId: string
  evidenceType: '0' | '1'
  evidenceName: string
  designId: string
  projectBaseIds: string[]
  remark: string
}

const weatherToolNames = new Set(['get-weather', 'weatherTool'])
const oaToolNames = new Set([
  'getMyWorkItems',
  'getWorkItemDetail',
  'generateDailyReportDraft',
  'getActiveDailyReportDraft',
  'prepareWorkHourFill',
  'queryDailyReportStatus',
  'submitDailyReport',
])
const OA_LOGIN_REQUIRED = 'OA_LOGIN_REQUIRED'
const OA_MY_WORK_ITEM_URL = '/app/pm/#/pm/myWorkitem/index'
const OA_PROJECT_LIST_URL = '/app/pm/#/pm/projectList/index'

const oaToolCopy: Record<
  string,
  { title: string; running: string; badge: string; icon: LucideIcon }
> = {
  getMyWorkItems: {
    title: '查询 OA 工作项',
    running: '正在读取当前用户可见的任务、需求和缺陷。',
    badge: 'Work Items',
    icon: ClipboardList,
  },
  getWorkItemDetail: {
    title: '查询工作项详情',
    running: '正在读取工作项详情。',
    badge: 'Detail',
    icon: ClipboardList,
  },
  generateDailyReportDraft: {
    title: '准备今日日报',
    running: '正在读取今天的 OA 日报和工作记录。',
    badge: 'Daily Report',
    icon: FileText,
  },
  getActiveDailyReportDraft: {
    title: '读取今天的日报',
    running: '正在读取今天在 OA 中的日报。',
    badge: 'Daily Report',
    icon: FileText,
  },
  prepareWorkHourFill: {
    title: '填工时',
    running: '正在读取可填工时的任务和缺陷。',
    badge: 'Work Hours',
    icon: Clock3,
  },
  queryDailyReportStatus: {
    title: '查询日报状态',
    running: '正在查询日报提交状态。',
    badge: 'Status',
    icon: FileText,
  },
  submitDailyReport: {
    title: '提交日报',
    running: '正在提交确认后的日报。',
    badge: 'Submit',
    icon: Send,
  },
}

export function AgentToolGroup({
  group,
  children,
}: PropsWithChildren<{ group: ThreadGroupPart }>) {
  return (
    <ToolGroupRoot variant='ghost' defaultOpen>
      <ToolGroupTrigger
        count={group.indices.length}
        active={group.status.type === 'running'}
      />
      <ToolGroupContent>{children}</ToolGroupContent>
    </ToolGroupRoot>
  )
}

export const AgentToolFallback: ToolCallMessagePartComponent = (props) => {
  const loginRequired = parseOaLoginRequired(props.result)
  if (loginRequired) {
    return <OaLoginRequiredCard message={loginRequired.message} />
  }

  const oaResult = parseOaToolResult(props.result, props.toolName)
  if (oaResult) {
    return <OaToolResultCard result={oaResult} />
  }

  if (oaToolNames.has(props.toolName)) {
    if (props.status?.type === 'running' || props.result === undefined) {
      return <OaToolLoadingCard toolName={props.toolName} />
    }

    return <ToolFallback {...props} />
  }

  if (!weatherToolNames.has(props.toolName)) {
    return <ToolFallback {...props} />
  }

  const result = parseWeatherResult(props.result)

  if (!result) {
    if (props.status?.type === 'running' || props.result === undefined) {
      return <WeatherToolLoadingCard location={readLocation(props.args)} />
    }

    return <ToolFallback {...props} />
  }

  return <WeatherToolCard weather={result} />
}

function OaToolResultCard({ result }: { result: OaToolResult }) {
  if (result.toolName === 'getMyWorkItems') {
    const workItems = parseWorkItemsResult(result.result)
    if (workItems) {
      return <OaWorkItemsCard result={workItems} message={result.message} />
    }
  }

  if (result.success === false || result.errorCode) {
    return <OaErrorCard result={result} />
  }

  if (
    result.toolName === 'generateDailyReportDraft' ||
    result.toolName === 'getActiveDailyReportDraft'
  ) {
    const draft = parseDailyReportDraftResult(result.result)
    if (draft) {
      if (isDailyReportMissingWorkHours(draft)) {
        return null
      }
      return <OaDailyReportDraftCard draft={draft} message={result.message} />
    }
    if (
      result.toolName === 'getActiveDailyReportDraft' &&
      isRecord(result.result) &&
      readBoolean(result.result.found) === false
    ) {
      return null
    }
  }

  if (result.toolName === 'prepareWorkHourFill') {
    const action = parseWorkHourFillActionResult(result.result)
    if (action) {
      return (
        <WorkHourFillActionCard
          items={action.items}
          workDate={action.workDate}
          confirmationContext={action.confirmationContext}
          message={result.message}
          title='填工时'
        />
      )
    }
  }

  if (result.toolName === 'queryDailyReportStatus') {
    return (
      <OaGenericResultCard
        icon={FileText}
        title='日报状态'
        badge='Status'
        message={result.message || '日报状态已返回'}
        result={result.result}
      />
    )
  }

  if (result.toolName === 'submitDailyReport') {
    return (
      <OaDailyReportSuccessCard
        auditId={
          result.auditId ||
          (isRecord(result.result)
            ? readString(result.result.auditId)
            : undefined)
        }
      />
    )
  }

  const copy = oaToolCopy[result.toolName]
  return (
    <OaGenericResultCard
      icon={copy?.icon ?? ClipboardList}
      title={copy?.title ?? 'OA 工具结果'}
      badge={copy?.badge ?? 'OA'}
      message={result.message || 'OA 工具已返回结果'}
      result={result.result}
    />
  )
}

function OaWorkItemsCard({
  result,
  message,
}: {
  result: WorkItemsResult
  message?: string
}) {
  const visibleItems = result.items.slice(0, 8)
  const userName = readText(result.user?.userName)
  const dateRange = formatDateRange(result.dateRange)
  const presentation = workItemQueryPresentation(result, message)
  const queryStatus = result.completeness.status
  const queryTone =
    queryStatus === 'FAILED'
      ? 'danger'
      : queryStatus === 'PARTIAL'
        ? 'warning'
        : 'default'

  return (
    <Card className='w-full max-w-2xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <IconFrame
            icon={queryStatus === 'COMPLETE' ? ClipboardList : AlertTriangle}
            tone={queryTone}
          />
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>
                {presentation.title}
              </CardTitle>
              <Badge
                variant={
                  queryStatus === 'FAILED'
                    ? 'destructive'
                    : queryStatus === 'PARTIAL'
                      ? 'outline'
                      : 'secondary'
                }
                className={
                  queryStatus === 'PARTIAL'
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : undefined
                }
              >
                {presentation.badge}
              </Badge>
            </div>
            <CardDescription className='mt-1'>
              {presentation.description}
            </CardDescription>
          </div>
          <CardAction>
            <Badge variant='outline'>{presentation.countLabel}</Badge>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col gap-4 px-4 sm:px-5'>
        <div className='grid gap-2 sm:grid-cols-3'>
          <OaMetric label='当前用户' value={userName || '-'} />
          <OaMetric label='日期范围' value={dateRange || '-'} />
          <OaMetric
            label='访问项目'
            value={
              result.visitedProjectCount === undefined
                ? '-'
                : `${result.visitedProjectCount} 个`
            }
          />
        </div>

        {presentation.noticeTitle && visibleItems.length ? (
          <div className='rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm'>
            <div className='flex items-start gap-2'>
              <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300' />
              <div className='min-w-0'>
                <div className='font-medium'>{presentation.noticeTitle}</div>
                <div className='text-muted-foreground mt-0.5 text-xs leading-5'>
                  {presentation.noticeDescription}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {visibleItems.length ? (
          <div className='overflow-hidden rounded-md border'>
            {visibleItems.map((item, index) => (
              <WorkItemRow
                key={readText(item.id) || readText(item.workItemId) || index}
                item={item}
              />
            ))}
          </div>
        ) : (
          <div
            className={cn(
              'rounded-md border px-3 py-4 text-sm',
              queryStatus === 'FAILED'
                ? 'border-destructive/30 bg-destructive/5'
                : queryStatus === 'PARTIAL'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'bg-muted/20'
            )}
          >
            <div className='flex items-start gap-2'>
              {queryStatus === 'COMPLETE' ? (
                <ClipboardList className='text-muted-foreground mt-0.5 size-4 shrink-0' />
              ) : (
                <AlertTriangle
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    queryStatus === 'FAILED'
                      ? 'text-destructive'
                      : 'text-amber-700 dark:text-amber-300'
                  )}
                />
              )}
              <div className='min-w-0'>
                <div className='font-medium'>{presentation.emptyTitle}</div>
                <div className='text-muted-foreground mt-1 text-xs leading-5'>
                  {presentation.emptyDescription}
                </div>
              </div>
            </div>
          </div>
        )}

        {result.items.length > visibleItems.length ? (
          <div className='text-muted-foreground text-xs'>
            已展示前 {visibleItems.length} 项，共 {result.items.length} 项。
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function WorkItemRow({ item }: { item: Record<string, unknown> }) {
  const title =
    readText(item.title) ||
    readText(item.name) ||
    readText(item.subject) ||
    readText(item.id) ||
    '未命名工作项'
  const type = readText(item.type) || readText(item.workItemType)
  const status = readText(item.status) || readText(item.state)
  const project =
    readText(item.projectTitle) ||
    readText(item.projectName) ||
    readText(item.project)
  const owner =
    readText(item.personChargeName) ||
    readText(item.ownerName) ||
    readText(item.assigneeName)
  const dueDate =
    readText(item.dueDate) ||
    readText(item.planEndDate) ||
    readText(item.endDate)

  return (
    <div className='border-border/70 flex flex-col gap-2 border-b px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between'>
      <div className='min-w-0 flex-1'>
        <div className='flex min-w-0 flex-wrap items-center gap-2'>
          {type ? (
            <Badge variant='outline'>{formatWorkItemType(type)}</Badge>
          ) : null}
          <div className='truncate text-sm font-medium'>{title}</div>
        </div>
        <div className='text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs'>
          {project ? <span>{project}</span> : null}
          {owner ? <span>负责人 {owner}</span> : null}
          {dueDate ? <span>截止 {formatDateText(dueDate)}</span> : null}
        </div>
      </div>
      {status ? (
        <Badge variant='secondary' className='self-start sm:self-center'>
          {status}
        </Badge>
      ) : null}
    </div>
  )
}

function OaDailyReportDraftCard({
  draft,
  message,
}: {
  draft: DailyReportDraftResult
  message?: string
}) {
  const threadRuntime = useThreadRuntime({ optional: true })
  const isUpdate = draft.operationMode === 'update'
  const operationCopy = dailyReportOperationCopy(draft.operationMode)
  const initiallySubmitted = draft.submitted || draft.status === 'SUBMITTED'
  const [serverDraft, setServerDraft] =
    useState<DailyReportDraftStatusResponse | null>(null)
  const [submitState, setSubmitState] = useState<
    'idle' | 'submitting' | 'success' | 'error'
  >(() => (initiallySubmitted ? 'success' : 'idle'))
  const [isExpanded, setIsExpanded] = useState(() => !initiallySubmitted)
  const [submitError, setSubmitError] = useState('')
  const [overdueReasons, setOverdueReasons] = useState<Record<string, string>>(
    () => initialOverdueReasons(draft.overdueReasonItems, draft.overdueReasons)
  )
  const [remarkDraft, setRemarkDraft] = useState(() => draft.remark || '')
  const [savedWorkHourKeys, setSavedWorkHourKeys] = useState<Set<string>>(
    () => new Set()
  )

  useEffect(() => {
    if (!draft.draftId) return

    let cancelled = false
    getDailyReportDraftStatus(draft.draftId)
      .then((status) => {
        if (cancelled) return
        setServerDraft(status)
        setOverdueReasons((current) =>
          mergeOverdueReasons(
            draft.overdueReasonItems,
            current,
            status.overdueReasons
          )
        )
        if (status.submitted || status.status === 'SUBMITTED') {
          setSubmitState('success')
          setSubmitError('')
          setIsExpanded(false)
        }
      })
      .catch(() => undefined)

    return () => {
      cancelled = true
    }
  }, [draft.draftId, draft.overdueReasonItems])
  const hasSubmitted =
    submitState === 'success' ||
    draft.submitted ||
    draft.status === 'SUBMITTED' ||
    Boolean(serverDraft?.submitted) ||
    serverDraft?.status === 'SUBMITTED'
  const missingOverdueReasonCount = hasSubmitted
    ? 0
    : draft.overdueReasonItems.filter(
        (item) => !overdueReasons[item.key]?.trim()
      ).length
  const showConfirmButton =
    draft.submitReady &&
    draft.requiresConfirmation &&
    Boolean(draft.draftId) &&
    submitState !== 'success'
  const canSubmit = showConfirmButton && missingOverdueReasonCount === 0
  const hasPendingOverdueReasons = missingOverdueReasonCount > 0
  const activeBlockers = draft.readiness.blockers.filter(
    (item) =>
      item.code !== 'MISSING_OVERDUE_REASONS' || missingOverdueReasonCount > 0
  )
  const hasValidationProblem =
    activeBlockers.length > 0 || draft.validationErrors.length > 0
  const needsAttention = hasValidationProblem
  const missingWorkHourItems = draft.missingWorkHourItems
  const missingWorkHourBlocker = draft.readiness.blockers.find(
    (item) => item.code === 'MISSING_WORK_HOURS'
  )
  const hasMissingWorkHours =
    Boolean(missingWorkHourBlocker) || isDailyReportMissingWorkHours(draft)
  const savedWorkHourCount = savedWorkHourKeys.size
  const hasStructuredMissingWorkHours =
    hasMissingWorkHours && missingWorkHourItems.length > 0
  const canRegenerateDraft =
    Boolean(threadRuntime) &&
    (!hasStructuredMissingWorkHours || savedWorkHourCount > 0)
  async function handleConfirm() {
    if (!draft.draftId || !canSubmit || submitState === 'submitting') return

    setSubmitState('submitting')
    setSubmitError('')
    const confirmedOverdueReasons = compactStringMap(overdueReasons)

    try {
      const response = await confirmDailyReport(
        {
          action: 'CONFIRM',
          agentId: readText(draft.confirmationContext?.agentId),
          runId: readText(draft.confirmationContext?.runId),
          traceId: readText(draft.confirmationContext?.traceId),
          draftId: draft.draftId,
          draftVersion: draft.draftVersion,
          idempotencyKey: draft.idempotencyKey,
          confirmedContent: remarkDraft,
          overdueReasons: confirmedOverdueReasons,
          confirmationContext: draft.confirmationContext,
        },
        draft.confirmEndpoint || '/api/agent/confirm'
      )
      if (!isDailyReportConfirmationAccepted(response)) {
        setSubmitState('error')
        setSubmitError(dailyReportErrorMessage(response))
        return
      }

      setSubmitState('success')
      const responseReasons = readStringRecord(response.result?.overdueReasons)
      const savedReasons = Object.keys(responseReasons).length
        ? responseReasons
        : confirmedOverdueReasons
      setOverdueReasons((current) =>
        mergeOverdueReasons(draft.overdueReasonItems, current, savedReasons)
      )
      setServerDraft({
        draftId: draft.draftId,
        status: 'SUBMITTED',
        submitted: true,
        overdueReasons: savedReasons,
        result: response.result,
        message: '日报已保存',
      })
      setIsExpanded(false)
      toast.success(isUpdate ? '日报修改已保存' : '日报提交成功', {
        description: '已同步到 OA',
        position: 'top-right',
      })
    } catch (error) {
      setSubmitState('error')
      setSubmitError(dailyReportErrorMessage(error))
    }
  }

  function handleRegenerateDraft() {
    if (!canRegenerateDraft) return
    threadRuntime?.append('重新生成日报草稿')
  }

  if (!hasSubmitted && hasMissingWorkHours) {
    return (
      <WorkHourFillActionCard
        items={missingWorkHourItems}
        workDate={draft.workDate}
        confirmationContext={draft.confirmationContext}
        message={
          missingWorkHourBlocker?.description ||
          message ||
          '请先为一项任务或缺陷登记工时，保存后即可继续生成日报。'
        }
        title={draft.readiness.title || '先登记工时，再生成日报'}
        emptyDescription='没有拿到可直接填工时的列表，可以先去我的工作项处理，再重新生成日报草稿。'
        onRegenerate={() => threadRuntime?.append('重新生成日报草稿')}
        references={draft.references}
      />
    )
  }

  const report =
    dailyReportContentFromDraft(draft) ?? parseDailyReportContent(draft.content)
  const workHourStats = dailyReportWorkHourStats(draft)
  const overdueMatches = matchOverdueReasonItems(
    report.sections,
    draft.overdueReasonItems
  )
  const unmatchedOverdueItems = draft.overdueReasonItems.filter(
    (item) => !overdueMatches.matchedKeys.has(item.key)
  )
  const statusText = hasSubmitted
    ? isUpdate
      ? '已保存'
      : '已提交'
    : hasValidationProblem
      ? '待补充'
      : operationCopy.pendingStatus
  const actionIconClass = hasValidationProblem
    ? 'bg-destructive/10 text-destructive'
    : hasPendingOverdueReasons
      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'bg-primary/10 text-primary'
  const actionTitle = hasSubmitted
    ? isUpdate
      ? '日报修改已保存'
      : '日报提交成功'
    : hasValidationProblem
      ? activeBlockers[0]?.title || '还有信息待补充'
      : operationCopy.readyAction
  const actionDescriptionClass = hasValidationProblem
    ? 'text-destructive'
    : hasPendingOverdueReasons
      ? 'text-amber-700 dark:text-amber-300'
      : 'text-muted-foreground'

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className='w-full max-w-3xl gap-0 overflow-hidden rounded-lg py-0 shadow-none'>
        <CardHeader
          className={cn('px-4 py-4 sm:px-5', isExpanded && 'border-b')}
        >
          <div className='flex items-start gap-3'>
            <IconFrame
              icon={
                hasSubmitted
                  ? CheckCircle2
                  : needsAttention
                    ? AlertTriangle
                    : FileText
              }
              tone={
                hasSubmitted
                  ? 'success'
                  : needsAttention
                    ? 'warning'
                    : 'default'
              }
            />
            <div className='min-w-0 flex-1'>
              <div className='flex min-w-0 flex-wrap items-center gap-2'>
                <CardTitle className='truncate text-base'>
                  {hasSubmitted
                    ? isUpdate
                      ? '日报修改已保存'
                      : '日报提交成功'
                    : hasValidationProblem
                      ? activeBlockers[0]?.title || '日报还需要补充信息'
                      : operationCopy.readyTitle}
                </CardTitle>
                {hasSubmitted ? (
                  <Badge variant='secondary'>
                    {isUpdate ? '已保存' : '已提交'}
                  </Badge>
                ) : hasValidationProblem ? (
                  <Badge variant='secondary'>待补充</Badge>
                ) : (
                  <Badge variant='secondary'>
                    {isUpdate ? operationCopy.pendingStatus : '可以提交'}
                  </Badge>
                )}
              </div>
              <CardDescription className='mt-1'>
                {hasSubmitted
                  ? `${draft.workDate ? `${draft.workDate} 的` : ''}日报已同步到 OA。`
                  : hasValidationProblem
                    ? activeBlockers[0]?.description ||
                      draft.readiness.description ||
                      message
                    : draft.readiness.status === 'ACTION_REQUIRED'
                      ? isUpdate
                        ? '需要补充的信息已填写，可以确认保存。'
                        : '需要补充的信息已填写，可以确认提交。'
                      : isUpdate
                        ? operationCopy.description
                        : draft.readiness.description ||
                          message ||
                          operationCopy.description}
              </CardDescription>
            </div>
            <CardAction>
              <CollapsibleTrigger asChild>
                <Button
                  type='button'
                  size='icon'
                  variant='ghost'
                  className='size-8'
                  aria-label={isExpanded ? '收起日报' : '展开日报'}
                  title={isExpanded ? '收起日报' : '展开日报'}
                >
                  <ChevronRight
                    className={cn(
                      'transition-transform duration-200',
                      isExpanded && 'rotate-90'
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </CardAction>
          </div>
        </CardHeader>

        <CollapsibleContent className='CollapsibleContent'>
          <CardContent className='flex flex-col gap-4 px-4 py-4 sm:px-5'>
            <div className='bg-muted/20 rounded-md border px-3 py-3 text-sm'>
              <label className='flex flex-col gap-2'>
                <span className='flex items-center gap-2 text-sm font-medium'>
                  <ClipboardList className='text-primary size-4' />
                  工作总结
                </span>
                <textarea
                  value={remarkDraft}
                  onChange={(event) => setRemarkDraft(event.target.value)}
                  disabled={hasSubmitted}
                  maxLength={1024}
                  placeholder='请填写工作总结，最多1024字'
                  className={cn(textareaClassName, 'min-h-24 resize-y')}
                />
                <span className='text-muted-foreground self-end text-xs'>
                  {remarkDraft.length}/1024
                </span>
              </label>
            </div>

            <div className='rounded-md border'>
              <div className='flex flex-wrap items-center justify-between gap-2 border-b px-3 py-3'>
                <div className='min-w-0'>
                  <div className='truncate text-sm font-medium'>
                    {hasSubmitted
                      ? `${draft.workDate ? `${draft.workDate} ` : ''}工作日报`
                      : report.title ||
                        `${draft.workDate || ''} 工作日报${isUpdate ? '' : '草稿'}`}
                  </div>
                  <div className='text-muted-foreground mt-1 text-xs'>
                    {dailyReportItemCount(report.sections)} 项明细
                  </div>
                </div>
                <Badge variant='outline'>
                  {hasSubmitted
                    ? isUpdate
                      ? '已保存'
                      : '已提交'
                    : operationCopy.reportBadge}
                </Badge>
              </div>

              {report.sections.length ? (
                <div className='divide-y'>
                  {report.sections.map((section) => (
                    <DailyReportSectionView
                      key={section.id}
                      section={section}
                      overdueMatches={overdueMatches}
                      overdueReasons={overdueReasons}
                      disabled={hasSubmitted}
                      onReasonChange={(key, value) =>
                        setOverdueReasons((current) => ({
                          ...current,
                          [key]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className='bg-muted/30 px-3 py-3 text-sm leading-6 whitespace-pre-wrap'>
                  {draft.content || '草稿内容为空'}
                </div>
              )}
            </div>

            {activeBlockers.length ? (
              <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-3 text-sm'>
                <div className='flex items-center gap-2 font-medium'>
                  <AlertTriangle className='size-4' />
                  {isUpdate ? '保存前还需要处理' : '提交前还需要处理'}
                </div>
                <div className='mt-2 space-y-2'>
                  {activeBlockers.map((item) => (
                    <div key={item.code}>
                      <div className='font-medium'>{item.title}</div>
                      {item.description ? (
                        <div className='mt-0.5 text-xs opacity-85'>
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {draft.readiness.suggestions.length ? (
              <div className='rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm'>
                <div className='flex items-center gap-2 font-medium text-amber-800 dark:text-amber-200'>
                  <HelpCircle className='size-4' />
                  可以再完善
                </div>
                <div className='mt-2 space-y-2'>
                  {draft.readiness.suggestions.map((item) => (
                    <div key={item.code}>
                      <div className='font-medium'>{item.title}</div>
                      {item.description ? (
                        <div className='text-muted-foreground mt-0.5 text-xs'>
                          {item.description}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {unmatchedOverdueItems.length ? (
              <div className='border-destructive/30 bg-destructive/5 rounded-md border px-3 py-3 text-sm'>
                <div className='text-destructive flex items-center gap-2 font-medium'>
                  <AlertTriangle className='size-4' />
                  待补充逾期原因
                </div>
                <div className='mt-3 flex flex-col gap-3'>
                  {unmatchedOverdueItems.map((item) => (
                    <OverdueReasonInput
                      key={item.key}
                      item={item}
                      value={overdueReasons[item.key] ?? ''}
                      disabled={hasSubmitted}
                      onChange={(value) =>
                        setOverdueReasons((current) => ({
                          ...current,
                          [item.key]: value,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <DailyReportReferencesView references={draft.references} />

            <div className='flex items-center gap-3 pt-1'>
              <span className='text-muted-foreground shrink-0 text-xs font-medium'>
                提交概览
              </span>
              <Separator className='flex-1' />
            </div>

            <DailyReportSummaryCards
              workDate={draft.workDate || '-'}
              workHourStats={workHourStats}
              statusText={statusText}
              hasSubmitted={hasSubmitted}
              hasValidationProblem={hasValidationProblem}
            />

            {submitError ? (
              <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-3 text-sm'>
                {submitError}
              </div>
            ) : null}

            <div className='bg-muted/30 flex flex-col gap-3 rounded-md border px-3 py-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='flex min-w-0 items-start gap-3'>
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                    actionIconClass
                  )}
                >
                  {needsAttention ? (
                    <AlertTriangle className='size-4' />
                  ) : (
                    <CheckCircle2 className='size-4' />
                  )}
                </div>
                <div className='min-w-0'>
                  <div className='text-sm font-medium'>{actionTitle}</div>
                  <div className={cn('mt-1 text-xs', actionDescriptionClass)}>
                    {savedWorkHourCount > 0
                      ? '已补充 ' +
                        savedWorkHourCount +
                        ' 项工时，请重新生成日报草稿后再提交'
                      : missingOverdueReasonCount > 0
                        ? `请填写剩余 ${missingOverdueReasonCount} 项逾期原因`
                        : activeBlockers[0]?.description ||
                          (hasSubmitted
                            ? 'OA 已保存本次日报'
                            : isUpdate
                              ? '请最后核对修改后的工作总结和日报明细'
                              : '请最后核对工作总结和日报明细')}
                  </div>
                </div>
              </div>

              <div className='flex flex-wrap items-center gap-2'>
                {hasStructuredMissingWorkHours ? (
                  <WorkHourFillSheet
                    items={missingWorkHourItems}
                    workDate={draft.workDate}
                    confirmationContext={draft.confirmationContext}
                    savedKeys={savedWorkHourKeys}
                    onSaved={(key) =>
                      setSavedWorkHourKeys((current) => {
                        const next = new Set(current)
                        next.add(key)
                        return next
                      })
                    }
                  />
                ) : hasMissingWorkHours ? (
                  <Button asChild size='sm' variant='outline'>
                    <a
                      href={OA_MY_WORK_ITEM_URL}
                      target='_blank'
                      rel='noreferrer'
                    >
                      <ExternalLink />
                      去我的工作项填写工时
                    </a>
                  </Button>
                ) : null}
                {!hasSubmitted && hasMissingWorkHours ? (
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={handleRegenerateDraft}
                    disabled={!threadRuntime}
                  >
                    <RefreshCw data-icon='inline-start' />
                    重新生成草稿
                  </Button>
                ) : null}
                {showConfirmButton ? (
                  <Button
                    size='sm'
                    onClick={handleConfirm}
                    disabled={!canSubmit || submitState === 'submitting'}
                  >
                    {submitState === 'submitting' ? (
                      <LoaderCircle className='animate-spin' />
                    ) : isUpdate ? (
                      <Save />
                    ) : (
                      <Send />
                    )}
                    {operationCopy.confirmLabel}
                  </Button>
                ) : null}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

function DailyReportReferencesView({
  references,
}: {
  references: DailyReportReferences
}) {
  if (!references.userContent.length && !references.oaSources.length) {
    return null
  }

  return (
    <div className='bg-muted/20 rounded-md border px-3 py-3 text-sm'>
      <div className='flex items-center gap-2 font-medium'>
        <CornerDownRight className='text-primary size-4' />
        本次草稿引用
      </div>
      {references.userContent.length ? (
        <div className='mt-3'>
          <div className='text-muted-foreground text-xs'>你的补充</div>
          <div className='border-primary/30 mt-1.5 border-l-2 pl-3 leading-6 whitespace-pre-wrap'>
            {references.userContent.join('\n')}
          </div>
        </div>
      ) : null}
      {references.oaSources.length ? (
        <div className='mt-3'>
          <div className='text-muted-foreground text-xs'>OA 工作数据</div>
          <div className='mt-1.5 flex flex-wrap gap-1.5'>
            {references.oaSources.map((source) => (
              <Badge key={source.type} variant='outline'>
                {source.label} {source.count}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function WorkHourFillActionCard({
  items,
  workDate,
  confirmationContext,
  message,
  title = '填工时',
  emptyDescription = '当前没有拿到可直接填工时的任务或缺陷，可以去我的工作项处理。',
  onRegenerate,
  references,
}: {
  items: MissingWorkHourItem[]
  workDate?: string
  confirmationContext?: Record<string, unknown>
  message?: string
  title?: string
  emptyDescription?: string
  onRegenerate?: () => void
  references?: DailyReportReferences
}) {
  const threadRuntime = useThreadRuntime({ optional: true })
  const [savedKeys, setSavedKeys] = useState<Set<string>>(() => new Set())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')
  const fillableItems = useMemo(
    () => items.filter((item) => item.canQuickFill !== false),
    [items]
  )
  const visibleItems = fillableItems.slice(0, 12)
  const savedCount = savedKeys.size
  const canQuickFill = fillableItems.length > 0
  const canRunDailyReport = Boolean(onRegenerate || threadRuntime)
  const shouldClampList = visibleItems.length > 4

  useEffect(() => {
    if (!canQuickFill) {
      setSelectedKey('')
      return
    }
    if (
      !selectedKey ||
      !fillableItems.some((item) => item.key === selectedKey)
    ) {
      setSelectedKey(fillableItems[0].key)
    }
  }, [canQuickFill, fillableItems, selectedKey])

  function handleSaved(key: string) {
    setSavedKeys((current) => {
      const next = new Set(current)
      next.add(key)
      return next
    })
  }

  function openWorkHourSheet(key: string) {
    setSelectedKey(key)
    setSheetOpen(true)
  }

  function handleRegenerateDailyReport() {
    if (!canRunDailyReport) return
    if (onRegenerate) {
      onRegenerate()
      return
    }
    threadRuntime?.append('重新生成日报草稿')
  }

  return (
    <Card className='w-full max-w-2xl gap-0 overflow-hidden rounded-xl py-0 shadow-sm'>
      <CardHeader className='border-b px-4 py-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <IconFrame
            icon={Hourglass}
            tone={canQuickFill ? 'warning' : 'default'}
          />
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>{title}</CardTitle>
              <Badge variant={canQuickFill ? 'secondary' : 'outline'}>
                {canQuickFill ? `${fillableItems.length} 项可填` : '暂无可填'}
              </Badge>
            </div>
            <CardDescription className='mt-1'>
              {message || '已为你提取当前可填写的任务和缺陷列表。'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col gap-0 px-0 py-0'>
        {references ? (
          <div className='border-b px-4 py-4 sm:px-5'>
            <DailyReportReferencesView references={references} />
          </div>
        ) : null}
        {canQuickFill ? (
          <>
            <div className='bg-muted/30 px-3 py-2'>
              <div className='text-muted-foreground mb-2 flex items-center justify-between gap-3 px-2 text-xs'>
                <span>请选择要填写的项</span>
                <span>
                  展示 1-{visibleItems.length} 项
                  {fillableItems.length > visibleItems.length
                    ? `，共 ${fillableItems.length} 项`
                    : ''}
                </span>
              </div>
              <div className='relative overflow-hidden'>
                <ScrollArea className={cn(shouldClampList && 'h-[280px]')}>
                  <div className='flex flex-col gap-1.5 px-1 pb-1'>
                    {visibleItems.map((item) => (
                      <WorkHourFillListItem
                        key={item.key}
                        item={item}
                        saved={savedKeys.has(item.key)}
                        onOpen={() => openWorkHourSheet(item.key)}
                      />
                    ))}
                  </div>
                </ScrollArea>
                {fillableItems.length > visibleItems.length ? (
                  <div className='from-muted/90 pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t to-transparent' />
                ) : null}
              </div>
            </div>

            <div className='flex flex-col gap-4 border-t px-4 py-4 sm:px-5'>
              <div className='bg-primary/5 flex items-start gap-2 rounded-lg border px-3 py-3'>
                <HelpCircle className='text-primary mt-0.5 size-4 shrink-0' />
                <div className='min-w-0 text-sm'>
                  <div className='font-medium'>
                    {savedCount > 0
                      ? `已保存 ${savedCount} / ${fillableItems.length} 项工时`
                      : `共 ${fillableItems.length} 项待填工时`}
                  </div>
                  <div className='text-muted-foreground mt-1 text-xs'>
                    保存后可重新生成日报草稿，系统会重新读取 OA 数据。
                  </div>
                </div>
              </div>

              <WorkHourQuickActions
                canWriteDailyReport={canRunDailyReport}
                onWriteDailyReport={handleRegenerateDailyReport}
              />
            </div>

            <WorkHourFillSheet
              items={fillableItems}
              workDate={workDate}
              confirmationContext={confirmationContext}
              savedKeys={savedKeys}
              onSaved={handleSaved}
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              selectedKey={selectedKey}
              onSelectedKeyChange={setSelectedKey}
              trigger={null}
            />
          </>
        ) : (
          <div className='flex flex-col gap-4 px-4 py-4 sm:px-5'>
            <div className='bg-muted/30 flex flex-col gap-3 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='min-w-0 text-sm'>
                <div className='font-medium'>当前没有可填工时的工作项</div>
                <div className='text-muted-foreground mt-1 text-xs'>
                  {emptyDescription}
                </div>
              </div>
              <div className='flex flex-wrap gap-2'>
                <Button asChild size='sm' variant='secondary'>
                  <a
                    href={OA_PROJECT_LIST_URL}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <Plus data-icon='inline-start' />
                    去创建任务/缺陷
                  </a>
                </Button>
                <Button asChild size='sm' variant='outline'>
                  <a
                    href={OA_MY_WORK_ITEM_URL}
                    target='_blank'
                    rel='noreferrer'
                  >
                    <ExternalLink data-icon='inline-start' />
                    去我的工作项
                  </a>
                </Button>
              </div>
            </div>
            <WorkHourQuickActions
              canWriteDailyReport={canRunDailyReport}
              onWriteDailyReport={handleRegenerateDailyReport}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function WorkHourQuickActions({
  canWriteDailyReport,
  onWriteDailyReport,
}: {
  canWriteDailyReport: boolean
  onWriteDailyReport: () => void
}) {
  return (
    <div className='flex flex-col gap-2'>
      <div className='text-muted-foreground px-1 text-xs font-medium'>
        猜你后续要做
      </div>
      <div className='flex flex-wrap gap-2'>
        <Button
          size='sm'
          variant='outline'
          className='rounded-full'
          onClick={onWriteDailyReport}
          disabled={!canWriteDailyReport}
        >
          <FileText data-icon='inline-start' />
          写日报
        </Button>
      </div>
    </div>
  )
}

function WorkHourFillListItem({
  item,
  saved,
  onOpen,
}: {
  item: MissingWorkHourItem
  saved: boolean
  onOpen: () => void
}) {
  const meta = [
    item.projectTitle,
    item.status,
    item.progress === undefined
      ? undefined
      : `进度 ${formatNumber(item.progress, 0)}%`,
    item.executionId && item.currentWorkHour !== undefined
      ? `已填 ${formatNumber(item.currentWorkHour)} 小时`
      : undefined,
  ].filter(Boolean)
  const isBug = item.type === 'bug' || item.typeName === '缺陷'
  const existing = item.operationMode === 'edit' || Boolean(item.executionId)

  return (
    <button
      type='button'
      className='group bg-background flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-all hover:border-amber-500/30 hover:shadow-sm'
      onClick={onOpen}
    >
      <span
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium',
          isBug
            ? 'border-destructive/20 bg-destructive/10 text-destructive'
            : 'border-blue-200 bg-blue-50 text-blue-700'
        )}
      >
        {item.typeName}
      </span>
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium group-hover:text-amber-700 dark:group-hover:text-amber-300'>
          {item.title || `${item.typeName} ${item.id}`}
        </div>
        {meta.length ? (
          <div className='text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs'>
            {meta.map((text, index) => (
              <Fragment key={`${item.key}-${text}-${index}`}>
                {index > 0 ? (
                  <span className='bg-muted-foreground/30 size-1 shrink-0 rounded-full' />
                ) : null}
                <span className={cn(index === 0 && 'max-w-32 truncate')}>
                  {text}
                </span>
              </Fragment>
            ))}
          </div>
        ) : (
          <div className='text-muted-foreground mt-1 truncate text-xs'>
            {item.reason || '-'}
          </div>
        )}
      </div>
      {saved ? (
        <Badge variant='secondary' className='shrink-0'>
          已保存
        </Badge>
      ) : existing ? (
        <Badge variant='outline' className='shrink-0'>
          已填写
        </Badge>
      ) : (
        <span className='hidden shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700 transition-opacity group-hover:flex dark:text-amber-300'>
          去填写
          <ChevronRight className='size-3' />
        </span>
      )}
    </button>
  )
}

function WorkHourFillSheet({
  items,
  workDate,
  confirmationContext,
  savedKeys,
  onSaved,
  open: controlledOpen,
  onOpenChange,
  selectedKey: controlledSelectedKey,
  onSelectedKeyChange,
  trigger,
}: {
  items: MissingWorkHourItem[]
  workDate?: string
  confirmationContext?: Record<string, unknown>
  savedKeys: Set<string>
  onSaved: (key: string) => void
  open?: boolean
  onOpenChange?: (open: boolean) => void
  selectedKey?: string
  onSelectedKeyChange?: (key: string) => void
  trigger?: ReactNode
}) {
  const fillableItems = useMemo(
    () => items.filter((item) => item.canQuickFill !== false),
    [items]
  )
  const [internalOpen, setInternalOpen] = useState(false)
  const [internalSelectedKey, setInternalSelectedKey] = useState(
    fillableItems[0]?.key ?? ''
  )
  const [options, setOptions] = useState<WorkHourOptionsResponse | null>(null)
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [optionsError, setOptionsError] = useState('')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>(
    'idle'
  )
  const [saveMessage, setSaveMessage] = useState('')
  const [highWorkHourPrompt, setHighWorkHourPrompt] = useState<{
    total: number
    threshold: number
  } | null>(null)
  const optionsRequestId = useRef(0)
  const [form, setForm] = useState<WorkHourFormState>(() =>
    initialWorkHourForm(fillableItems[0], null, workDate)
  )
  const open = controlledOpen ?? internalOpen
  const selectedKey = controlledSelectedKey ?? internalSelectedKey

  function setOpen(nextOpen: boolean) {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  const setSelectedKey = useCallback(
    (nextKey: string) => {
      if (controlledSelectedKey === undefined) {
        setInternalSelectedKey(nextKey)
      }
      onSelectedKeyChange?.(nextKey)
    },
    [controlledSelectedKey, onSelectedKeyChange]
  )

  const selectedItem =
    fillableItems.find((item) => item.key === selectedKey) ?? fillableItems[0]
  const conversationId =
    readText(confirmationContext?.sessionId) ||
    readText(confirmationContext?.threadId) ||
    ''

  useEffect(() => {
    if (!open || selectedKey || !fillableItems[0]) return
    setSelectedKey(fillableItems[0].key)
  }, [fillableItems, open, selectedKey, setSelectedKey])

  const loadWorkHourOptions = useCallback(
    async (item: MissingWorkHourItem, requestedDate?: string) => {
      const requestId = ++optionsRequestId.current
      setLoadingOptions(true)
      setOptionsError('')
      setSaveState('idle')
      setSaveMessage('')

      try {
        const response = await getWorkHourOptions(
          item,
          requestedDate,
          conversationId
        )
        if (requestId !== optionsRequestId.current) return
        setOptions(response)
        setForm(initialWorkHourForm(item, response, requestedDate || workDate))
      } catch (error) {
        if (requestId !== optionsRequestId.current) return
        setOptions(null)
        setOptionsError(
          workHourErrorMessage(error, '暂时无法读取工时表单，请稍后重试。')
        )
      } finally {
        if (requestId === optionsRequestId.current) setLoadingOptions(false)
      }
    },
    [conversationId, workDate]
  )

  useEffect(() => {
    if (!open || !selectedItem) return
    void loadWorkHourOptions(selectedItem, selectedItem.workDate || workDate)

    return () => {
      optionsRequestId.current += 1
    }
  }, [loadWorkHourOptions, open, selectedItem, workDate])

  function handleWorkDateChange(nextWorkDate: string) {
    if (!selectedItem || nextWorkDate === form.workDate) return
    setForm((current) => ({ ...current, workDate: nextWorkDate }))
    void loadWorkHourOptions(selectedItem, nextWorkDate)
  }

  async function handleSave(highWorkHourConfirmed = false) {
    if (!selectedItem || !options || saveState === 'saving') return

    if (
      options.workDate !== form.workDate ||
      !isAllowedWorkHourDate(options, form.workDate)
    ) {
      setSaveState('error')
      setSaveMessage('日期信息正在刷新，请稍后再保存。')
      if (isAllowedWorkHourDate(options, form.workDate)) {
        void loadWorkHourOptions(selectedItem, form.workDate)
      }
      return
    }

    const validationMessage = validateWorkHourForm(selectedItem, form, options)
    if (validationMessage) {
      setSaveState('error')
      setSaveMessage(validationMessage)
      return
    }

    setSaveState('idle')
    setSaveMessage('')
    const highWorkHour = highWorkHourConfirmation(
      options,
      Number(form.workHour)
    )
    if (!highWorkHourConfirmed && highWorkHour.required) {
      setHighWorkHourPrompt(highWorkHour)
      return
    }

    setSaveState('saving')
    setSaveMessage('')
    const description = form.description.trim()
    const evidences = buildEvidencePayload(selectedItem, form, options)

    try {
      const response = await saveWorkHourExecutionWithIntentRefresh(
        {
          type: selectedItem.type,
          workItemId: selectedItem.id,
          executionId: options.executionId || selectedItem.executionId,
          originalWorkDate:
            options.originalWorkDate ||
            selectedItem.workDate ||
            options.workDate,
          workDate: form.workDate,
          workCategory: form.workCategory,
          workHour: Number(form.workHour),
          progress: Number(form.progress),
          executionDesc: selectedItem.type === 'task' ? description : undefined,
          description: selectedItem.type === 'bug' ? description : undefined,
          evidences,
          idempotencyKey: options.idempotencyKey,
          highWorkHourConfirmed,
          confirmationContext,
        },
        conversationId
      )

      if (
        response.errorCode ||
        response.code ||
        response.status !== 'ACCEPTED'
      ) {
        if (isHighWorkHourConfirmationRequired(response)) {
          setSaveState('idle')
          setHighWorkHourPrompt(
            highWorkHourConfirmationDetails(response, highWorkHour)
          )
          return
        }
        setSaveState('error')
        setSaveMessage(workHourErrorMessage(response))
        return
      }

      onSaved(selectedItem.key)
      setSaveState('idle')
      toast.success('保存成功', { position: 'top-right' })

      const currentIndex = fillableItems.findIndex(
        (item) => item.key === selectedItem.key
      )
      const orderedItems = [
        ...fillableItems.slice(currentIndex + 1),
        ...fillableItems.slice(0, currentIndex),
      ]
      const nextItem = orderedItems.find(
        (item) =>
          item.key !== selectedItem.key &&
          !savedKeys.has(item.key) &&
          !item.executionId &&
          item.operationMode !== 'edit'
      )
      if (nextItem) {
        setSelectedKey(nextItem.key)
      } else {
        setOpen(false)
      }
    } catch (error) {
      if (isHighWorkHourConfirmationRequired(error)) {
        setSaveState('idle')
        setHighWorkHourPrompt(
          highWorkHourConfirmationDetails(error, highWorkHour)
        )
        return
      }
      setSaveState('error')
      setSaveMessage(workHourErrorMessage(error))
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger === null ? null : (
        <SheetTrigger asChild>
          {trigger ?? (
            <Button size='sm' variant='outline'>
              <Plus data-icon='inline-start' />
              填工时
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent className='w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl'>
        <SheetHeader className='shrink-0 border-b'>
          <SheetTitle>填写日报工时</SheetTitle>
          <SheetDescription>
            选择一个任务或缺陷，直接在当前页面填写执行工时。保存后请重新生成日报草稿。
          </SheetDescription>
        </SheetHeader>

        <div className='grid min-h-0 flex-1 overflow-hidden md:grid-cols-[24rem_minmax(0,1fr)]'>
          <ScrollArea className='min-h-0 border-b md:border-r md:border-b-0'>
            <div className='flex flex-col gap-2 p-4'>
              {fillableItems.map((item) => {
                const saved = savedKeys.has(item.key)
                const selected = item.key === selectedItem?.key
                const meta = [
                  item.projectTitle,
                  item.status,
                  item.progress === undefined
                    ? undefined
                    : `进度 ${formatNumber(item.progress, 0)}%`,
                  item.executionId && item.currentWorkHour !== undefined
                    ? `已填 ${formatNumber(item.currentWorkHour)} 小时`
                    : undefined,
                ].filter(Boolean)
                const isBug = item.type === 'bug' || item.typeName === '缺陷'

                return (
                  <button
                    key={item.key}
                    type='button'
                    disabled={loadingOptions || saveState === 'saving'}
                    className={cn(
                      'group bg-background flex w-full min-w-0 items-center gap-3 rounded-lg border border-transparent px-2.5 py-2.5 text-left transition-all',
                      selected && 'border-amber-500/30 shadow-sm',
                      'disabled:cursor-not-allowed disabled:opacity-60'
                    )}
                    onClick={() => setSelectedKey(item.key)}
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium',
                        isBug
                          ? 'border-destructive/20 bg-destructive/10 text-destructive'
                          : 'border-blue-200 bg-blue-50 text-blue-700'
                      )}
                    >
                      {item.typeName}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm font-medium group-hover:text-amber-700 dark:group-hover:text-amber-300'>
                        {item.title || `${item.typeName} ${item.id}`}
                      </div>
                      {meta.length ? (
                        <div className='text-muted-foreground mt-1 flex min-w-0 items-center gap-1.5 text-xs'>
                          {meta.map((text, index) => (
                            <Fragment key={`${item.key}-${text}-${index}`}>
                              {index > 0 ? (
                                <span className='bg-muted-foreground/30 size-1 shrink-0 rounded-full' />
                              ) : null}
                              <span
                                className={cn(
                                  index === 0 && 'max-w-32 truncate'
                                )}
                              >
                                {text}
                              </span>
                            </Fragment>
                          ))}
                        </div>
                      ) : (
                        <div className='text-muted-foreground mt-1 truncate text-xs'>
                          {item.reason || '-'}
                        </div>
                      )}
                    </div>
                    {saved ? (
                      <Badge variant='secondary' className='shrink-0'>
                        已保存
                      </Badge>
                    ) : item.operationMode === 'edit' || item.executionId ? (
                      <Badge variant='outline' className='shrink-0'>
                        已填写
                      </Badge>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </ScrollArea>

          <ScrollArea className='min-h-0'>
            <div className='flex flex-col gap-4 p-4'>
              {selectedItem ? (
                <>
                  <div className='grid gap-2 sm:grid-cols-2'>
                    <OaMetric label='工作项' value={selectedItem.typeName} />
                    <OaMetric
                      label='当前进度'
                      value={formatOptionalPercent(selectedItem.progress)}
                    />
                  </div>

                  {loadingOptions ? (
                    <div className='flex flex-col gap-3'>
                      <Skeleton className='h-9 w-full' />
                      <Skeleton className='h-28 w-full' />
                    </div>
                  ) : optionsError ? (
                    <div className='border-destructive/30 bg-destructive/5 rounded-md border px-3 py-3 text-sm'>
                      <div className='text-destructive'>{optionsError}</div>
                      <Button
                        type='button'
                        variant='outline'
                        size='sm'
                        className='mt-3'
                        onClick={() =>
                          void loadWorkHourOptions(
                            selectedItem,
                            form.workDate || selectedItem.workDate || workDate
                          )
                        }
                      >
                        <RefreshCw data-icon='inline-start' />
                        重新加载
                      </Button>
                    </div>
                  ) : (
                    <WorkHourFormFields
                      item={selectedItem}
                      options={options}
                      form={form}
                      disabled={loadingOptions || saveState === 'saving'}
                      onWorkDateChange={handleWorkDateChange}
                      onChange={(patch) =>
                        setForm((current) => ({ ...current, ...patch }))
                      }
                    />
                  )}

                  {saveMessage && saveState === 'error' ? (
                    <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-3 text-sm'>
                      {saveMessage}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className='text-muted-foreground rounded-md border border-dashed px-3 py-8 text-center text-sm'>
                  暂无可填工时的任务或缺陷
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <SheetFooter className='shrink-0 border-t sm:flex-row sm:items-center sm:justify-between'>
          <div className='text-muted-foreground text-xs'>
            暂不处理 SVN 物证；遇到必须选择 SVN 文件的任务，请回 OA 处理该物证。
          </div>
          <Button
            onClick={() => void handleSave()}
            disabled={
              !selectedItem ||
              !options ||
              loadingOptions ||
              saveState === 'saving' ||
              options.workDate !== form.workDate ||
              !isAllowedWorkHourDate(options, form.workDate)
            }
          >
            {saveState === 'saving' ? (
              <LoaderCircle data-icon='inline-start' className='animate-spin' />
            ) : (
              <Send data-icon='inline-start' />
            )}
            {options?.operationMode === 'edit' ? '更新工时' : '保存工时'}
          </Button>
        </SheetFooter>
      </SheetContent>

      <Dialog
        open={highWorkHourPrompt !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && saveState !== 'saving') setHighWorkHourPrompt(null)
        }}
      >
        <DialogContent showCloseButton={saveState !== 'saving'}>
          <DialogHeader>
            <DialogTitle>确认保存这条工时？</DialogTitle>
            <DialogDescription>
              保存后，{form.workDate} 当天累计工时将达到{' '}
              {formatNumber(highWorkHourPrompt?.total ?? 0)} 小时，超过标准工时
              {formatNumber(highWorkHourPrompt?.threshold ?? 7.5)}{' '}
              小时。请确认记录无误。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={saveState === 'saving'}
              onClick={() => setHighWorkHourPrompt(null)}
            >
              取消
            </Button>
            <Button
              type='button'
              disabled={saveState === 'saving'}
              onClick={() => {
                setHighWorkHourPrompt(null)
                void handleSave(true)
              }}
            >
              {saveState === 'saving' ? (
                <LoaderCircle
                  data-icon='inline-start'
                  className='animate-spin'
                />
              ) : (
                <CheckCircle2 data-icon='inline-start' />
              )}
              确认保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sheet>
  )
}

function WorkHourFormFields({
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

const nativeControlClassName =
  'border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

const textareaClassName =
  'border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 min-h-24 w-full rounded-md border px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50'

function initialWorkHourForm(
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

function validateWorkHourForm(
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

function buildEvidencePayload(
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

function createEvidenceDraft(): WorkHourEvidenceDraft {
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

function updateEvidenceDraft(
  evidences: WorkHourEvidenceDraft[],
  clientId: string,
  patch: Partial<WorkHourEvidenceDraft>
) {
  return evidences.map((evidence) =>
    evidence.clientId === clientId ? { ...evidence, ...patch } : evidence
  )
}

function groupProjectBases(projectBases: Record<string, unknown>[]) {
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

function toggleStringList(values: string[], value: string, checked: boolean) {
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

function formatOptionalPercent(value?: number) {
  return value === undefined ? '-' : formatNumber(value, 0) + '%'
}

function combinedWorkHourRecords(
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

function evidenceTitle(record: Record<string, unknown>) {
  return (
    readText(record.title) ||
    readText(record.evidenceName) ||
    readText(record.name) ||
    '物证 ' + (readText(record.id) || '')
  )
}

function projectBaseTitle(record: Record<string, unknown>) {
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

function DailyReportSectionView({
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

function OverdueReasonInput({
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

function OaGenericResultCard({
  icon,
  title,
  badge,
  message,
  result,
  tone = 'default',
}: {
  icon: LucideIcon
  title: string
  badge: string
  message: string
  result?: Record<string, unknown>
  tone?: 'default' | 'success'
}) {
  const entries = Object.entries(result ?? {})
    .filter(([, value]) => value !== undefined && value !== null)
    .slice(0, 6)

  return (
    <Card className='w-full max-w-2xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <IconFrame icon={icon} tone={tone} />
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>{title}</CardTitle>
              <Badge variant='secondary'>OA</Badge>
            </div>
            <CardDescription className='mt-1'>{message}</CardDescription>
          </div>
          <CardAction>
            <Badge variant='outline'>{badge}</Badge>
          </CardAction>
        </div>
      </CardHeader>
      {entries.length ? (
        <CardContent className='grid gap-2 px-4 sm:grid-cols-2 sm:px-5'>
          {entries.map(([key, value]) => (
            <OaMetric key={key} label={key} value={formatDisplayValue(value)} />
          ))}
        </CardContent>
      ) : null}
    </Card>
  )
}

function OaDailyReportSuccessCard({ auditId }: { auditId?: string }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className='w-full max-w-2xl gap-0 overflow-hidden rounded-lg py-0 shadow-none'>
        <CardHeader
          className={cn('px-4 py-4 sm:px-5', isExpanded && 'border-b')}
        >
          <div className='flex items-start gap-3'>
            <IconFrame icon={CheckCircle2} tone='success' />
            <div className='min-w-0 flex-1'>
              <CardTitle className='text-base'>日报提交成功</CardTitle>
              <CardDescription className='mt-1'>已同步到 OA。</CardDescription>
            </div>
            {auditId ? (
              <CardAction>
                <CollapsibleTrigger asChild>
                  <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    className='size-8'
                    aria-label={isExpanded ? '收起提交详情' : '展开提交详情'}
                    title={isExpanded ? '收起提交详情' : '展开提交详情'}
                  >
                    <ChevronRight
                      className={cn(
                        'transition-transform duration-200',
                        isExpanded && 'rotate-90'
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
              </CardAction>
            ) : null}
          </div>
        </CardHeader>
        {auditId ? (
          <CollapsibleContent className='CollapsibleContent'>
            <CardContent className='px-4 py-3 sm:px-5'>
              <div className='text-muted-foreground text-xs break-all'>
                提交记录：{auditId}
              </div>
            </CardContent>
          </CollapsibleContent>
        ) : null}
      </Card>
    </Collapsible>
  )
}

function OaErrorCard({ result }: { result: OaToolResult }) {
  const isDailyReportError =
    result.toolName === 'generateDailyReportDraft' ||
    result.toolName === 'getActiveDailyReportDraft' ||
    result.toolName === 'queryDailyReportStatus' ||
    result.toolName === 'submitDailyReport'
  const isValidationError =
    result.errorCode === 'DAILY_REPORT_VALIDATION_FAILED'
  const isWorkHourError =
    result.errorCode?.includes('WORK_HOUR') ||
    result.toolName === 'prepareWorkHourFill' ||
    result.toolName === 'saveWorkHourExecution'
  const Icon = isValidationError ? AlertTriangle : XCircle
  const title = isValidationError
    ? '日报校验未通过'
    : isDailyReportError
      ? '日报暂未保存'
      : isWorkHourError
        ? '工时未保存'
        : '暂时无法完成操作'
  const message = isWorkHourError
    ? workHourErrorMessage(result)
    : isDailyReportError
      ? dailyReportErrorMessage(result)
      : result.message || '请稍后重试，或检查当前 OA 登录状态。'

  return (
    <Card className='w-full max-w-xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <IconFrame icon={Icon} tone='danger' />
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>{title}</CardTitle>
            </div>
            <CardDescription className='mt-1'>{message}</CardDescription>
          </div>
        </div>
      </CardHeader>
      {result.auditId && !isDailyReportError ? (
        <CardContent className='px-4 sm:px-5'>
          <div className='text-muted-foreground rounded-md border px-3 py-2 text-xs'>
            审计编号：{result.auditId}
          </div>
        </CardContent>
      ) : null}
    </Card>
  )
}

function OaToolLoadingCard({ toolName }: { toolName: string }) {
  const copy = oaToolCopy[toolName] ?? {
    title: '执行 OA 工具',
    running: '正在等待 OA 工具返回结果。',
    badge: 'OA',
    icon: LoaderCircle,
  }

  return (
    <Card className='w-full max-w-xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='px-4 sm:px-5'>
        <div className='flex items-center gap-3'>
          <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg'>
            <LoaderCircle className='animate-spin' />
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>{copy.title}</CardTitle>
              <Badge variant='outline'>{copy.badge}</Badge>
            </div>
            <CardDescription className='mt-1'>{copy.running}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col gap-3 px-4 sm:px-5'>
        <Skeleton className='h-8 w-40' />
        <Skeleton className='h-20 rounded-md' />
      </CardContent>
    </Card>
  )
}

function OaLoginRequiredCard({ message }: { message: string }) {
  return (
    <Card className='w-full max-w-xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <IconFrame icon={ShieldAlert} />
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>需要登录 OA</CardTitle>
              <Badge variant='secondary'>OA</Badge>
            </div>
            <CardDescription className='mt-1'>
              {message || '当前未登录，正在跳转到现有系统登录页'}
            </CardDescription>
          </div>
          <CardAction>
            <Button size='sm' onClick={() => redirectToOaLogin()}>
              <LogIn />
              去登录
            </Button>
          </CardAction>
        </div>
      </CardHeader>
    </Card>
  )
}

function WeatherToolCard({ weather }: { weather: WeatherResult }) {
  return (
    <Card className='w-full max-w-xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <IconFrame icon={CloudSun} />
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>
                {weather.location}天气
              </CardTitle>
              <Badge variant='secondary'>AG-UI 工具结果</Badge>
            </div>
            <CardDescription className='mt-1 flex items-center gap-1.5'>
              <MapPin />
              <span className='truncate'>{weather.conditions}</span>
            </CardDescription>
          </div>
          <CardAction>
            <Badge variant='outline'>Weather Tool</Badge>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col gap-4 px-4 sm:px-5'>
        <div className='flex flex-wrap items-end gap-x-4 gap-y-2'>
          <div className='text-4xl leading-none font-semibold tracking-normal'>
            {formatTemperature(weather.temperature)}
          </div>
          <div className='text-muted-foreground pb-1 text-sm'>
            体感 {formatTemperature(weather.feelsLike)}
          </div>
        </div>

        <Separator />

        <div className='grid gap-3 sm:grid-cols-3'>
          <WeatherMetric
            icon={Droplets}
            label='湿度'
            value={`${formatNumber(weather.humidity, 0)}%`}
          />
          <WeatherMetric
            icon={Wind}
            label='风速'
            value={`${formatNumber(weather.windSpeed)} km/h`}
          />
          <WeatherMetric
            icon={Wind}
            label='阵风'
            value={`${formatNumber(weather.windGust)} km/h`}
          />
        </div>
      </CardContent>
    </Card>
  )
}

function WeatherMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon
  label: string
  value: string
}) {
  return (
    <div className='flex min-w-0 items-center gap-2'>
      <div className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md'>
        <Icon />
      </div>
      <div className='min-w-0'>
        <div className='text-muted-foreground text-xs'>{label}</div>
        <div className='truncate text-sm font-medium'>{value}</div>
      </div>
    </div>
  )
}

function WeatherToolLoadingCard({ location }: { location?: string }) {
  return (
    <Card className='w-full max-w-xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='px-4 sm:px-5'>
        <div className='flex items-center gap-3'>
          <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-lg'>
            <LoaderCircle className='animate-spin' />
          </div>
          <div className='min-w-0 flex-1'>
            <CardTitle className='truncate text-base'>
              正在获取{location ? `${location}` : ''}天气
            </CardTitle>
            <CardDescription>AG-UI 正在等待 Weather Tool 结果</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='flex flex-col gap-3 px-4 sm:px-5'>
        <Skeleton className='h-8 w-32' />
        <div className='grid gap-3 sm:grid-cols-3'>
          <Skeleton className='h-10 rounded-md' />
          <Skeleton className='h-10 rounded-md' />
          <Skeleton className='h-10 rounded-md' />
        </div>
      </CardContent>
    </Card>
  )
}

function IconFrame({
  icon: Icon,
  tone = 'default',
}: {
  icon: LucideIcon
  tone?: 'default' | 'warning' | 'danger' | 'success'
}) {
  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-lg',
        tone === 'danger'
          ? 'bg-destructive/10 text-destructive'
          : tone === 'warning'
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
            : tone === 'success'
              ? 'bg-green-500/10 text-green-700 dark:text-green-300'
              : 'bg-primary/10 text-primary'
      )}
    >
      <Icon />
    </div>
  )
}

function DailyReportSummaryCards({
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

function OaMetric({
  label,
  value,
  description,
}: {
  label: string
  value: string
  description?: string
}) {
  return (
    <div className='bg-muted/40 min-w-0 rounded-md border px-3 py-2'>
      <div className='text-muted-foreground truncate text-xs'>{label}</div>
      <div className='truncate text-sm font-medium'>{value}</div>
      {description ? (
        <div className='text-muted-foreground mt-0.5 truncate text-xs'>
          {description}
        </div>
      ) : null}
    </div>
  )
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

function dailyReportWorkHourStats(draft: DailyReportDraftResult) {
  const task = sumDailyReportWorkHours(draft.taskWork)
  const bug = sumDailyReportWorkHours(draft.bugWork)
  return {
    task,
    bug,
    total: task + bug,
  }
}

function sumDailyReportWorkHours(records: Record<string, unknown>[]) {
  return records.reduce((total, record) => {
    const value = firstRecordValue(
      record,
      'totalWorkHours',
      'actualWorkHours',
      'workHours'
    )
    return total + workHourNumberFromValue(value)
  }, 0)
}

function workHourNumberFromValue(value: unknown) {
  const numeric = numberValue(value)
  if (numeric !== undefined) return numeric
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/u)
    if (match) {
      const parsed = Number(match[0])
      return Number.isFinite(parsed) ? parsed : 0
    }
  }
  return 0
}

function dailyReportContentFromDraft(
  draft: DailyReportDraftResult
): DailyReportContent | undefined {
  if (!draft.hasStructuredContent) return undefined

  const tomorrow = nextDateText(draft.workDate)
  return {
    title: draft.workDate
      ? `${draft.workDate} 工作日报${draft.operationMode === 'update' ? '' : '草稿'}`
      : draft.operationMode === 'update'
        ? '工作日报'
        : '工作日报草稿',
    sections: [
      dailyReportStructuredSection(
        'tasks',
        '今日任务',
        draft.taskWork,
        (record, index) => dailyReportWorkLine(record, 'tasks', 'task', index)
      ),
      dailyReportStructuredSection(
        'bugs',
        '今日缺陷',
        draft.bugWork,
        (record, index) => dailyReportWorkLine(record, 'bugs', 'bug', index)
      ),
      dailyReportStructuredSection(
        'problems',
        '待解决问题',
        draft.unresolvedProblem,
        (record, index) => dailyReportIssueLine(record, 'problems', index)
      ),
      dailyReportStructuredSection(
        'risks',
        '待解决风险',
        draft.unresolvedRisk,
        (record, index) => dailyReportIssueLine(record, 'risks', index)
      ),
      dailyReportStructuredSection(
        'plan',
        tomorrow ? `${tomorrow} 明日计划` : '明日工作计划',
        draft.tomorrowWorkPlan,
        (record, index) => dailyReportWorkLine(record, 'plan', 'task', index)
      ),
    ],
  }
}

function dailyReportStructuredSection(
  kind: DailyReportSectionKind,
  title: string,
  records: Record<string, unknown>[],
  mapRecord: (record: Record<string, unknown>, index: number) => DailyReportLine
): DailyReportSection {
  return {
    id: `${kind}-structured`,
    title,
    kind,
    items: records.map(mapRecord),
  }
}

function dailyReportWorkLine(
  record: Record<string, unknown>,
  kind: DailyReportSectionKind,
  workItemType: 'task' | 'bug',
  index: number
): DailyReportLine {
  const rawId = readRecordText(record, 'id', 'rawId')
  const project = readRecordText(record, 'projectTitle', 'projectName')
  const title = readRecordText(record, 'title', 'name') || '未命名工作项'
  const status = readRecordText(record, 'status', 'statusName')
  const executionDesc = readRecordText(record, 'executionDesc', 'overdueReason')

  return {
    id: dailyReportRecordLineId(kind, record, index, workItemType),
    text: dailyReportLineText(project, title),
    body: dailyReportLineText(project, title),
    rawId,
    workItemType,
    project,
    title,
    progress: readRecordPercent(record, 'process', 'progress'),
    personalProgress:
      kind === 'tasks'
        ? readRecordPercent(record, 'personalProgress')
        : undefined,
    status,
    hours: dailyReportHoursText(record),
    overdueDays: readRecordNumber(record, 'overdueDays'),
    executionText: executionDesc,
  }
}

function dailyReportIssueLine(
  record: Record<string, unknown>,
  kind: DailyReportSectionKind,
  index: number
): DailyReportLine {
  const project = readRecordText(record, 'projectTitle', 'projectName')
  const title = readRecordText(record, 'title', 'name') || '未命名事项'
  const status = readRecordText(record, 'status', 'statusName')
  const measure =
    kind === 'risks'
      ? readRecordText(record, 'treatmentMeasures')
      : readRecordText(record, 'correctionMeasures')
  const riskValue = kind === 'risks' ? readRecordText(record, 'riskValue') : ''
  const planEndDate = readRecordText(record, 'planEndDate')
  const detailParts = [
    measure,
    riskValue ? `风险值 ${riskValue}` : '',
    planEndDate ? `计划解决 ${planEndDate}` : '',
  ].filter(Boolean)

  return {
    id: dailyReportRecordLineId(kind, record, index),
    text: dailyReportLineText(project, title),
    body: dailyReportLineText(project, title),
    rawId: readRecordText(record, 'id', 'rawId'),
    project,
    title,
    detail: detailParts.length ? detailParts.join(' · ') : undefined,
    status,
  }
}

function dailyReportRecordLineId(
  kind: DailyReportSectionKind,
  record: Record<string, unknown>,
  index: number,
  workItemType?: string
) {
  const rawId = readRecordText(record, 'id', 'rawId')
  if (rawId) return `${kind}-${workItemType || 'item'}-${rawId}`
  return `${kind}-${index}-${normalizeDailyReportText(
    readRecordText(record, 'title', 'name')
  ).slice(0, 24)}`
}

function dailyReportLineText(project: string, title: string) {
  return project ? `【${project}】${title}` : title
}

function dailyReportHoursText(record: Record<string, unknown>) {
  const value = firstRecordValue(
    record,
    'totalWorkHours',
    'actualWorkHours',
    'workHours'
  )
  if (value === undefined) return undefined
  const numeric = numberValue(value)
  if (numeric !== undefined) {
    return `${formatNumber(numeric)}h`
  }
  const text = readText(value)?.trim()
  if (!text) return undefined
  return text.replace(/^耗时\s*/u, '')
}

function readRecordText(record: Record<string, unknown>, ...fields: string[]) {
  const value = firstRecordValue(record, ...fields)
  return readText(value)?.trim() ?? ''
}

function readRecordNumber(
  record: Record<string, unknown>,
  ...fields: string[]
) {
  const value = firstRecordValue(record, ...fields)
  return value === undefined ? undefined : numberValue(value)
}

function readRecordPercent(
  record: Record<string, unknown>,
  ...fields: string[]
) {
  const value = firstRecordValue(record, ...fields)
  if (typeof value === 'string') {
    const match = value.match(/-?\d+(?:\.\d+)?/u)
    if (!match) return undefined
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return numberValue(value)
}

function firstRecordValue(
  record: Record<string, unknown>,
  ...fields: string[]
) {
  for (const field of fields) {
    const value = record[field]
    if (value === undefined || value === null) continue
    if (typeof value === 'string' && !value.trim()) continue
    return value
  }
  return undefined
}

function nextDateText(value?: string) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/u)
  if (!match) return ''
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  )
  date.setDate(date.getDate() + 1)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function parseDailyReportContent(content: string): DailyReportContent {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const sections: DailyReportSection[] = []
  let title: string | undefined
  let current: DailyReportSection | undefined

  for (const line of lines) {
    const header = parseDailyReportSectionHeader(line)
    if (header) {
      current = {
        id: `${header.kind}-${sections.length}`,
        title: header.title,
        kind: header.kind,
        items: [],
      }
      sections.push(current)
      if (header.inlineText) {
        current.items.push(
          parseDailyReportLine(header.inlineText, current.kind, 0)
        )
      }
      continue
    }

    if (!title && line.includes('日报')) {
      title = line
      continue
    }

    if (!current) {
      current = {
        id: `other-${sections.length}`,
        title: '其他内容',
        kind: 'other',
        items: [],
      }
      sections.push(current)
    }

    current.items.push(
      parseDailyReportLine(line, current.kind, current.items.length)
    )
  }

  return { title, sections }
}

function parseDailyReportSectionHeader(line: string):
  | {
      kind: DailyReportSectionKind
      title: string
      inlineText?: string
    }
  | undefined {
  const definitions: Array<{
    kind: DailyReportSectionKind
    pattern: RegExp
    title?: string
  }> = [
    { kind: 'tasks', pattern: /^今日任务[：:]\s*(.*)$/u, title: '今日任务' },
    { kind: 'bugs', pattern: /^今日缺陷[：:]\s*(.*)$/u, title: '今日缺陷' },
    {
      kind: 'problems',
      pattern: /^待解决问题[：:]\s*(.*)$/u,
      title: '待解决问题',
    },
    {
      kind: 'risks',
      pattern: /^待解决风险[：:]\s*(.*)$/u,
      title: '待解决风险',
    },
    { kind: 'plan', pattern: /^(.*明日计划)[：:]\s*(.*)$/u },
  ]

  for (const definition of definitions) {
    const match = line.match(definition.pattern)
    if (!match) continue
    const title =
      definition.title ||
      match[1]?.trim() ||
      dailyReportKindTitle(definition.kind)
    const inlineText = (definition.title ? match[1] : match[2])?.trim()
    return {
      kind: definition.kind,
      title,
      inlineText,
    }
  }

  return undefined
}

function dailyReportKindTitle(kind: DailyReportSectionKind) {
  switch (kind) {
    case 'tasks':
      return '今日任务'
    case 'bugs':
      return '今日缺陷'
    case 'problems':
      return '待解决问题'
    case 'risks':
      return '待解决风险'
    case 'plan':
      return '明日计划'
    default:
      return '其他内容'
  }
}

function parseDailyReportLine(
  rawLine: string,
  kind: DailyReportSectionKind,
  index: number
): DailyReportLine {
  const body = rawLine.replace(/^\d+[.、]\s*/u, '').trim()
  const summary = body === '暂无' || /^(\.\.\.|…)/u.test(body)
  let project: string | undefined
  let title = body

  const projectMatch = body.match(/^【([^】]+)】\s*(.*)$/u)
  const content = projectMatch ? projectMatch[2].trim() : body
  if (projectMatch) {
    project = projectMatch[1].trim()
    title = content
  }

  const detailMatch =
    content.match(/^(.*?)（(.*)）$/u) || content.match(/^(.*?)\((.*)\)$/u)
  let rawDetail: string | undefined
  if (detailMatch) {
    title = detailMatch[1].trim() || content
    rawDetail = detailMatch[2].trim()
  }

  const sourceForMeta = rawDetail || body
  const status = extractDailyReportStatus(sourceForMeta)
  const detail = visibleDailyReportDetail(rawDetail, status)

  return {
    id: `${kind}-${index}-${normalizeDailyReportText(rawLine).slice(0, 24)}`,
    text: rawLine,
    body,
    project,
    title: title || body,
    detail,
    progress: extractDailyReportProgress(sourceForMeta),
    status,
    hours: extractDailyReportHours(sourceForMeta),
    executionText: detail,
    summary,
  }
}

function extractDailyReportProgress(value: string) {
  const match = value.match(/(\d+(?:\.\d+)?)%/u)
  if (!match) return undefined
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : undefined
}

function extractDailyReportHours(value: string) {
  const match = value.match(/耗时\s*(\d+(?:\.\d+)?\s*(?:h|小时)?)/iu)
  if (!match) return undefined
  const text = match[1].replace(/\s/g, '')
  return /(?:h|小时)$/iu.test(text) ? text : `${text}h`
}

function extractDailyReportStatus(value: string) {
  const parts = value
    .split(/[，,]/u)
    .map((part) => part.trim())
    .filter(Boolean)

  return parts.find(
    (part) => !/^\d+(?:\.\d+)?%$/u.test(part) && !part.includes('耗时')
  )
}

function visibleDailyReportDetail(value: string | undefined, status?: string) {
  if (!value) return undefined
  const parts = value
    .replace(/^[，,\s]+/u, '')
    .split(/[，,]/u)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      if (/^\d+(?:\.\d+)?%$/u.test(part)) return false
      if (part.includes('耗时')) return false
      return !status || part !== status
    })

  return parts.length ? parts.join('，') : undefined
}

function dailyReportItemCount(sections: DailyReportSection[]) {
  return sections.reduce((count, section) => {
    return (
      count +
      section.items.reduce((sectionCount, item) => {
        const extra = item.text.match(/还有\s*(\d+)\s*项/u)
        if (extra) return sectionCount + Number(extra[1])
        return sectionCount + (item.summary ? 0 : 1)
      }, 0)
    )
  }, 0)
}

function matchOverdueReasonItems(
  sections: DailyReportSection[],
  items: OverdueReasonItem[]
): OverdueLineMatches {
  const byLineId = new Map<string, OverdueReasonItem>()
  const matchedKeys = new Set<string>()

  for (const section of sections) {
    for (const line of section.items) {
      const match = items.find(
        (item) =>
          !matchedKeys.has(item.key) &&
          dailyReportLineMatchesOverdueItem(section.kind, line, item)
      )
      if (!match) continue
      byLineId.set(line.id, match)
      matchedKeys.add(match.key)
    }
  }

  return { byLineId, matchedKeys }
}

function dailyReportLineWorkItemKey(
  line: DailyReportLine,
  kind: DailyReportSectionKind
) {
  if (!line.rawId) return undefined
  const type =
    line.workItemType ||
    (kind === 'tasks' ? 'task' : kind === 'bugs' ? 'bug' : undefined)
  if (type !== 'task' && type !== 'bug') return undefined
  return `${type}:${line.rawId}`
}

function isEditableDailyReportWorkText(
  line: DailyReportLine,
  kind: DailyReportSectionKind,
  overdueItem?: OverdueReasonItem
) {
  if (kind !== 'tasks' && kind !== 'bugs') return false
  if (overdueItem) return true
  return (
    line.overdueDays !== undefined &&
    line.overdueDays > 0 &&
    workHourNumberFromValue(line.hours) <= 0
  )
}

function dailyReportLineMatchesOverdueItem(
  kind: DailyReportSectionKind,
  line: DailyReportLine,
  item: OverdueReasonItem
) {
  if (line.summary) return false
  if (kind === 'tasks' && item.type.toLowerCase() !== 'task') return false
  if (kind === 'bugs' && item.type.toLowerCase() !== 'bug') return false
  if (kind !== 'tasks' && kind !== 'bugs') return false

  if (
    line.rawId &&
    line.workItemType &&
    line.workItemType.toLowerCase() === item.type.toLowerCase() &&
    String(line.rawId) === item.id
  ) {
    return true
  }

  const itemTitle = normalizeDailyReportText(item.title || '')
  const lineTitle = normalizeDailyReportText(line.title)
  if (!itemTitle || itemTitle !== lineTitle) return false

  const itemProject = normalizeDailyReportText(item.projectTitle || '')
  const lineProject = normalizeDailyReportText(line.project || '')
  return !itemProject || !lineProject || itemProject === lineProject
}

function normalizeDailyReportText(value: string) {
  return value.replace(/[\s【】（）()，,。；;:：]/gu, '').toLowerCase()
}

function parseOaLoginRequired(
  result: unknown
): OaLoginRequiredResult | undefined {
  const parsed = typeof result === 'string' ? parseJson(result) : result
  if (!isRecord(parsed)) return undefined

  const errorCode = readString(parsed.errorCode)
  if (errorCode !== OA_LOGIN_REQUIRED) return undefined

  return {
    message:
      readString(parsed.message) || '当前未登录，正在跳转到现有系统登录页',
  }
}

function parseOaToolResult(
  result: unknown,
  fallbackToolName: string
): OaToolResult | undefined {
  const parsed = typeof result === 'string' ? parseJson(result) : result
  if (!isRecord(parsed)) return undefined

  const toolName = readString(parsed.toolName) || fallbackToolName
  if (!oaToolNames.has(toolName)) return undefined

  return {
    toolName,
    success: readBoolean(parsed.success),
    message: readString(parsed.message),
    errorCode: readString(parsed.errorCode),
    auditId: readString(parsed.auditId),
    result: isRecord(parsed.result) ? parsed.result : undefined,
  }
}

function parseDailyReportDraftResult(
  result: Record<string, unknown> | undefined
): DailyReportDraftResult | undefined {
  if (!result) return undefined
  const content = readString(result.content)

  const validationErrors = stringList(result.validationErrors)
  const validationWarnings = stringList(result.validationWarnings).filter(
    (item) => !validationErrors.includes(item)
  )
  const submitReady =
    readBoolean(result.submitReady) ?? validationErrors.length === 0
  const overdueReasonItems = readOverdueReasonItems(result.overdueReasonItems)
  const missingWorkHourItems = readMissingWorkHourItems(
    result.missingWorkHourItems
  )
  const taskWork = readRecordList(result.taskWork)
  const bugWork = readRecordList(result.bugWork)
  const tomorrowWorkPlan = readRecordList(result.tomorrowWorkPlan)
  const unresolvedProblem = readRecordList(result.unresolvedProblem)
  const unresolvedRisk = readRecordList(result.unresolvedRisk)
  const readiness = readDailyReportReadiness(
    result.readiness,
    validationErrors,
    validationWarnings,
    submitReady,
    overdueReasonItems,
    missingWorkHourItems
  )
  const references = readDailyReportReferences(
    result.references,
    result.sourceData
  )
  const oaReportId = readString(result.oaReportId)
  const operationMode = dailyReportOperationMode(
    result.operationMode,
    readBoolean(result.existingReport) === true || Boolean(oaReportId)
  )
  const existingReport =
    readBoolean(result.existingReport) === true || operationMode === 'update'
  const hasStructuredContent = Boolean(
    taskWork ||
    bugWork ||
    tomorrowWorkPlan ||
    unresolvedProblem ||
    unresolvedRisk
  )
  if (
    !content &&
    !readString(result.draftId) &&
    !hasStructuredContent &&
    validationErrors.length === 0 &&
    missingWorkHourItems.length === 0
  ) {
    return undefined
  }

  return {
    draftId: readString(result.draftId),
    draftVersion: readNumber(result.draftVersion),
    workDate: readString(result.workDate),
    operationMode,
    existingReport,
    oaReportId,
    status: readString(result.status),
    submitted: readBoolean(result.submitted),
    content: content || '',
    remark: readString(result.remark),
    hasStructuredContent,
    taskWork: taskWork ?? [],
    bugWork: bugWork ?? [],
    tomorrowWorkPlan: tomorrowWorkPlan ?? [],
    unresolvedProblem: unresolvedProblem ?? [],
    unresolvedRisk: unresolvedRisk ?? [],
    overdueReasons: readStringRecord(result.overdueReasons),
    validationErrors,
    validationWarnings,
    overdueReasonItems,
    missingWorkHourItems,
    readiness,
    references,
    requiresOverdueReasons:
      readBoolean(result.requiresOverdueReasons) ??
      overdueReasonItems.length > 0,
    submitReady,
    requiresConfirmation:
      readBoolean(result.requiresConfirmation) ?? submitReady,
    confirmEndpoint: readString(result.confirmEndpoint),
    idempotencyKey: readString(result.idempotencyKey),
    confirmationContext: isRecord(result.confirmationContext)
      ? result.confirmationContext
      : undefined,
  }
}

function readDailyReportReadiness(
  value: unknown,
  validationErrors: string[],
  validationWarnings: string[],
  submitReady: boolean,
  overdueReasonItems: OverdueReasonItem[],
  missingWorkHourItems: MissingWorkHourItem[]
): DailyReportReadiness {
  if (isRecord(value)) {
    const blockers = readDailyReportReadinessItems(value.blockers)
    const suggestions = readDailyReportReadinessItems(value.suggestions)
    return {
      status:
        readString(value.status) ||
        (blockers.length
          ? 'ACTION_REQUIRED'
          : submitReady
            ? 'READY'
            : 'PENDING'),
      title:
        readString(value.title) || (blockers[0]?.title ?? '日报草稿已整理好'),
      description: readString(value.description),
      blockers,
      suggestions,
      nextActions: readDailyReportNextActions(value.nextActions),
    }
  }

  const blockers: DailyReportReadinessItem[] = []
  if (
    missingWorkHourItems.length ||
    validationErrors.some(isMissingWorkHoursValidation)
  ) {
    blockers.push({
      code: 'MISSING_WORK_HOURS',
      title: '今天还没有有效工时',
      description: '请先为一项任务或缺陷登记工时，保存后再重新生成日报。',
      action: 'FILL_WORK_HOURS',
      count: missingWorkHourItems.length || undefined,
    })
  } else if (validationErrors.length) {
    blockers.push({
      code: 'MISSING_REQUIRED_DATA',
      title: '日报还缺少必要信息',
      description: validationErrors.join('；'),
    })
  }
  if (overdueReasonItems.length) {
    blockers.push({
      code: 'MISSING_OVERDUE_REASONS',
      title: `还有 ${overdueReasonItems.length} 项逾期原因待补充`,
      description: '请在对应任务或缺陷下填写原因，补齐后即可提交。',
      action: 'FILL_OVERDUE_REASONS',
      count: overdueReasonItems.length,
    })
  }
  const suggestions = validationWarnings.map((description, index) => ({
    code: `SUGGESTION_${index + 1}`,
    title: '建议完善日报内容',
    description,
  }))
  return {
    status: blockers.length
      ? 'ACTION_REQUIRED'
      : submitReady
        ? 'READY'
        : 'PENDING',
    title: blockers[0]?.title || '日报草稿已整理好',
    blockers,
    suggestions,
    nextActions: [],
  }
}

function readDailyReportReadinessItems(
  value: unknown
): DailyReportReadinessItem[] {
  return (readRecordList(value) ?? []).map((item, index) => ({
    code: readString(item.code) || `ITEM_${index + 1}`,
    title: readString(item.title) || '还有信息待补充',
    description: readString(item.description),
    action: readString(item.action),
    count: readNumber(item.count),
  }))
}

function readDailyReportNextActions(value: unknown): DailyReportNextAction[] {
  return (readRecordList(value) ?? [])
    .map((item): DailyReportNextAction | undefined => {
      const action = readString(item.action)
      const label = readString(item.label)
      return action && label ? { action, label } : undefined
    })
    .filter((item): item is DailyReportNextAction => Boolean(item))
}

function readDailyReportReferences(
  value: unknown,
  sourceData: unknown
): DailyReportReferences {
  if (isRecord(value)) {
    return {
      userContent: stringList(value.userContent),
      oaSources: (readRecordList(value.oaSources) ?? [])
        .map((item): DailyReportReferenceSource | undefined => {
          const type = readString(item.type)
          const label = readString(item.label)
          const count = readNumber(item.count)
          return type && label && count !== undefined
            ? { type, label, count }
            : undefined
        })
        .filter((item): item is DailyReportReferenceSource => Boolean(item)),
    }
  }

  const counts =
    isRecord(sourceData) && isRecord(sourceData.counts)
      ? sourceData.counts
      : undefined
  if (!counts) return { userContent: [], oaSources: [] }
  const sourceDefinitions = [
    ['taskWork', 'TODAY_TASKS', '今日任务'],
    ['bugWork', 'TODAY_BUGS', '今日缺陷'],
    ['tomorrowTaskPlan', 'TOMORROW_PLAN', '明日计划'],
    ['unresolvedProblems', 'OPEN_PROBLEMS', '待解决问题'],
    ['unresolvedRisks', 'OPEN_RISKS', '待解决风险'],
  ] as const
  return {
    userContent: [],
    oaSources: sourceDefinitions.map(([key, type, label]) => ({
      type,
      label,
      count: readNumber(counts[key]) ?? 0,
    })),
  }
}

function parseWorkHourFillActionResult(
  result: Record<string, unknown> | undefined
): WorkHourFillActionResult | undefined {
  if (!result) return undefined
  const items = readMissingWorkHourItems(
    result.missingWorkHourItems ?? result.items
  )

  return {
    workDate: readString(result.workDate),
    items,
    confirmationContext: isRecord(result.confirmationContext)
      ? result.confirmationContext
      : undefined,
  }
}

function parseWeatherResult(result: unknown): WeatherResult | undefined {
  const parsed = typeof result === 'string' ? parseJson(result) : result
  const value =
    isRecord(parsed) && isRecord(parsed.result) ? parsed.result : parsed
  if (!isRecord(value)) return undefined

  const weather = {
    temperature: readNumber(value.temperature),
    feelsLike: readNumber(value.feelsLike),
    humidity: readNumber(value.humidity),
    windSpeed: readNumber(value.windSpeed),
    windGust: readNumber(value.windGust),
    conditions: readString(value.conditions),
    location: readString(value.location),
  }

  if (
    weather.temperature === undefined ||
    weather.feelsLike === undefined ||
    weather.humidity === undefined ||
    weather.windSpeed === undefined ||
    weather.windGust === undefined ||
    !weather.conditions ||
    !weather.location
  ) {
    return undefined
  }

  return weather as WeatherResult
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readRecordList(value: unknown) {
  if (!Array.isArray(value)) return undefined
  return value.filter(isRecord)
}

function readOverdueReasonItems(value: unknown): OverdueReasonItem[] {
  return (readRecordList(value) ?? [])
    .map((item): OverdueReasonItem | undefined => {
      const id = readText(item.id)
      const type = readString(item.type) || 'workItem'
      const key = readText(item.key) || (id ? type + ':' + id : '')
      if (!id || !key) return undefined
      return {
        key,
        type,
        typeName: readString(item.typeName) || formatWorkItemType(type),
        id,
        title: readString(item.title),
        projectTitle: readString(item.projectTitle),
        process: readString(item.process),
        status: readString(item.status),
        overdueDays: readNumber(item.overdueDays),
      }
    })
    .filter((item): item is OverdueReasonItem => Boolean(item))
}

function readMissingWorkHourItems(value: unknown): MissingWorkHourItem[] {
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

function initialOverdueReasons(
  items: OverdueReasonItem[],
  storedReasons: Record<string, string> = {}
) {
  return Object.fromEntries(
    items.map((item) => [item.key, storedReasons[item.key] ?? ''])
  )
}

function mergeOverdueReasons(
  items: OverdueReasonItem[],
  currentReasons: Record<string, string>,
  storedReasons: Record<string, string> = {}
) {
  const next = initialOverdueReasons(items, storedReasons)
  for (const [key, value] of Object.entries(currentReasons)) {
    const current = value.trim()
    if (current) {
      next[key] = value
    }
  }
  return next
}

function compactStringMap(values: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(values)
      .map(([key, value]) => [key, value.trim()] as const)
      .filter(([, value]) => Boolean(value))
  )
}

function readStringRecord(value: unknown) {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, child]) => [key, readText(child)?.trim() ?? ''] as const)
      .filter(([, child]) => Boolean(child))
  )
}

function overdueReasonTitle(item: OverdueReasonItem) {
  return item.title || item.typeName + ' ' + item.id
}

function readNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function numberValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function readBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function readString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function readText(value: unknown) {
  if (typeof value === 'string') return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

function stringList(value: unknown) {
  const values = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value]
  return Array.from(
    new Set(
      values
        .map((item) => readText(item)?.trim())
        .filter((item): item is string => Boolean(item))
    )
  )
}

function isMissingWorkHoursValidation(message: string) {
  const normalized = message.replace(/\s/g, '')
  return (
    normalized.includes('必要工时') ||
    normalized.includes('工时信息') ||
    normalized.includes('workHours')
  )
}

function isDailyReportMissingWorkHours(draft: DailyReportDraftResult) {
  return [...draft.validationErrors, ...draft.validationWarnings].some(
    isMissingWorkHoursValidation
  )
}

function readLocation(args: unknown) {
  const value = typeof args === 'string' ? parseJson(args) : args
  return isRecord(value) ? readString(value.location) : undefined
}

function formatTemperature(value: number) {
  return `${formatNumber(value)}°C`
}

function formatNumber(value: number, maximumFractionDigits = 1) {
  return new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits,
  }).format(value)
}

function formatDateRange(value?: Record<string, unknown>) {
  if (!value) return ''
  const begin = readText(value.beginDate) || readText(value.startDate)
  const end = readText(value.endDate)
  if (begin && end && begin !== end)
    return `${formatDateText(begin)} 至 ${formatDateText(end)}`
  return formatDateText(begin || end || '')
}

function formatDateText(value: string) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).format(parsed)
}

function formatWorkItemType(value: string) {
  const normalized = value.toLowerCase()
  if (normalized === 'task') return '任务'
  if (normalized === 'requirement' || normalized === 'req') return '需求'
  if (normalized === 'bug') return '缺陷'
  return value
}

function formatDisplayValue(value: unknown) {
  if (typeof value === 'boolean') return value ? '是' : '否'
  const text = readText(value)
  if (text) return text
  if (Array.isArray(value)) return `${value.length} 项`
  if (isRecord(value)) return JSON.stringify(value)
  return '-'
}
