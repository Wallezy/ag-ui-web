import { useEffect, useState } from 'react'
import { useThreadRuntime } from '@assistant-ui/react'
import {
  AlertTriangle,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  LoaderCircle,
  RefreshCw,
  Save,
  Send,
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
import { Separator } from '@/components/ui/separator'
import {
  confirmDailyReport,
  getDailyReportDraftStatus,
  type DailyReportDraftStatusResponse,
} from '../api'
import {
  dailyReportErrorMessage,
  dailyReportOperationCopy,
} from '../daily-report'
import { isDailyReportConfirmationAccepted } from '../daily-report-confirmation'
import { OA_MY_WORK_ITEM_URL } from './constants'
import {
  DailyReportSectionView,
  DailyReportSummaryCards,
  OverdueReasonInput,
} from './daily-report-content-ui'
import {
  compactStringMap,
  dailyReportContentFromDraft,
  dailyReportItemCount,
  dailyReportWorkHourStats,
  initialOverdueReasons,
  isDailyReportMissingWorkHours,
  matchOverdueReasonItems,
  mergeOverdueReasons,
  parseDailyReportContent,
  readStringRecord,
  type DailyReportDraftResult,
} from './daily-report-model'
import { DailyReportReferencesView } from './daily-report-references'
import { IconFrame, textareaClassName } from './primitives'
import { readText } from './shared'
import { WorkHourFillActionCard, WorkHourFillSheet } from './work-hour-ui'

export function OaDailyReportDraftCard({
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
    : missingOverdueReasonCount > 0
      ? `还需填写 ${missingOverdueReasonCount} 项逾期原因`
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
                      ? isUpdate
                        ? '日报修改待补充'
                        : '日报草稿待补充'
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
                    ? isUpdate
                      ? '请完成必填项，补齐后即可保存。'
                      : '请完成必填项，补齐后即可提交。'
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
                        ? '请在上方红框中补充原因，完成后即可提交'
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
