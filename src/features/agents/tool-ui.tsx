import { useState, type PropsWithChildren } from 'react'
import { type ToolCallMessagePartComponent } from '@assistant-ui/react'
import {
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  LoaderCircle,
  LogIn,
  Send,
  ShieldAlert,
  XCircle,
  type LucideIcon,
} from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import type { ThreadGroupPart } from '@/components/assistant-ui/thread'
import { ToolFallback } from '@/components/assistant-ui/tool-fallback'
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from '@/components/assistant-ui/tool-group'
import { redirectToOaLogin, type MissingWorkHourItem } from './api'
import { dailyReportErrorMessage } from './daily-report'
import {
  isDailyReportMissingWorkHours,
  parseDailyReportDraftResult,
} from './tool-ui/daily-report-model'
import {
  OaDailyReportDraftCard,
  OaDailyReportStatusCard,
} from './tool-ui/daily-report-ui'
import { IconFrame, OaMetric } from './tool-ui/primitives'
import {
  formatDisplayValue,
  isRecord,
  parseJson,
  readBoolean,
  readString,
} from './tool-ui/shared'
import { parseWeatherResult, readLocation } from './tool-ui/weather-data'
import { WeatherToolCard, WeatherToolLoadingCard } from './tool-ui/weather-ui'
import { readMissingWorkHourItems } from './tool-ui/work-hour-data'
import { WorkHourFillActionCard } from './tool-ui/work-hour-ui'
import { OaWorkItemsCard } from './tool-ui/work-items-ui'
import { workHourErrorMessage } from './work-hour'
import { parseWorkItemsResult } from './work-items-result'

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

type WorkHourFillActionResult = {
  workDate?: string
  items: MissingWorkHourItem[]
  confirmationContext?: Record<string, unknown>
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
    title: '读取日报详情',
    running: '正在读取 OA 中的日报详情。',
    badge: 'Daily Report',
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
      <OaDailyReportStatusCard
        result={result.result}
        message={result.message}
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
