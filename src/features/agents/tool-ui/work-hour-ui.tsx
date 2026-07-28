import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  HelpCircle,
  Hourglass,
  LoaderCircle,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
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
import {
  getWorkHourOptions,
  prepareDailyReport,
  saveWorkHourExecutionWithIntentRefresh,
  type MissingWorkHourItem,
  type WorkHourOptionsResponse,
} from '../api'
import { dailyReportErrorMessage } from '../daily-report'
import {
  highWorkHourConfirmation,
  highWorkHourConfirmationDetails,
  hasPositiveWorkHour,
  isAllowedWorkHourDate,
  isHighWorkHourConfirmationRequired,
  workHourErrorMessage,
} from '../work-hour'
import { OA_MY_WORK_ITEM_URL, OA_PROJECT_LIST_URL } from './constants'
import {
  parseDailyReportDraftResult,
  type DailyReportDraftResult,
  type DailyReportReferences,
} from './daily-report-model'
import { DailyReportReferencesView } from './daily-report-references'
import { IconFrame, OaMetric } from './primitives'
import { formatNumber, readText } from './shared'
import { WorkHourFormFields } from './work-hour-form-fields'
import {
  buildEvidencePayload,
  formatOptionalPercent,
  initialWorkHourForm,
  validateWorkHourForm,
  type WorkHourFormState,
} from './work-hour-form-model'

export function WorkHourFillActionCard({
  items,
  workDate,
  confirmationContext,
  message,
  title = '填工时',
  emptyDescription = '当前没有拿到可直接填工时的任务或缺陷，可以去我的工作项处理。',
  onDailyReportPrepared,
  references,
}: {
  items: MissingWorkHourItem[]
  workDate?: string
  confirmationContext?: Record<string, unknown>
  message?: string
  title?: string
  emptyDescription?: string
  onDailyReportPrepared: (
    draft: DailyReportDraftResult,
    message?: string
  ) => void
  references?: DailyReportReferences
}) {
  const [savedWorkHours, setSavedWorkHours] = useState<Map<string, number>>(
    () => new Map()
  )
  const [prepareState, setPrepareState] = useState<
    'idle' | 'checking' | 'missing' | 'error'
  >('idle')
  const [prepareMessage, setPrepareMessage] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState('')
  const fillableItems = useMemo(
    () => items.filter((item) => item.canQuickFill !== false),
    [items]
  )
  const visibleItems = fillableItems.slice(0, 12)
  const savedKeys = useMemo(
    () => new Set(savedWorkHours.keys()),
    [savedWorkHours]
  )
  const savedCount = savedWorkHours.size
  const hasSavedPositiveWorkHour = hasPositiveWorkHour(savedWorkHours.values())
  const canQuickFill = fillableItems.length > 0
  const shouldClampList = visibleItems.length > 4
  const conversationId =
    readText(confirmationContext?.sessionId) ||
    readText(confirmationContext?.threadId)
  const canPrepareDailyReport = Boolean(workDate && conversationId)

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

  function handleSaved(key: string, workHour: number) {
    setSavedWorkHours((current) => {
      const next = new Map(current)
      next.set(key, workHour)
      return next
    })
  }

  function openWorkHourSheet(key: string) {
    setSelectedKey(key)
    setSheetOpen(true)
  }

  async function handlePrepareDailyReport() {
    if (!workDate || !conversationId || prepareState === 'checking') return

    setPrepareState('checking')
    setPrepareMessage('')
    try {
      const response = await prepareDailyReport({
        workDate,
        conversationId,
        userSupplement: references?.userContent.join('\n'),
        confirmationContext,
      })
      if (response.status === 'DRAFT_READY') {
        const draft = parseDailyReportDraftResult(response.result)
        if (!draft) {
          setPrepareState('error')
          setPrepareMessage('日报数据已返回，但页面暂时无法展示，请稍后重试。')
          return
        }
        onDailyReportPrepared(draft, response.message)
        return
      }
      if (response.status === 'MISSING_WORK_HOURS') {
        setPrepareState('missing')
        setPrepareMessage(
          response.message || 'OA 中仍未检测到大于 0 小时的有效工时。'
        )
        return
      }
      setPrepareState('error')
      setPrepareMessage(
        response.status === 'UNKNOWN'
          ? 'OA 工时数据读取不完整，暂时无法确认，请稍后重新检查。'
          : response.message || '暂时无法检查工时，请稍后重试。'
      )
    } catch (error) {
      setPrepareState('error')
      setPrepareMessage(
        dailyReportErrorMessage(error, '暂时无法检查工时，请稍后重试。')
      )
    }
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
                    {hasSavedPositiveWorkHour
                      ? '已保存有效工时，可以继续写日报。'
                      : savedCount > 0
                        ? '当前页面保存的工时为 0；写日报时会重新检查 OA 最新工时。'
                        : '可以直接写日报；系统会先检查 OA 中是否已有有效工时。'}
                  </div>
                </div>
              </div>
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
          </div>
        )}
        <DailyReportContinuation
          hasSavedPositiveWorkHour={hasSavedPositiveWorkHour}
          canPrepare={canPrepareDailyReport}
          state={prepareState}
          message={prepareMessage}
          onPrepare={handlePrepareDailyReport}
        />
      </CardContent>
    </Card>
  )
}

function DailyReportContinuation({
  hasSavedPositiveWorkHour,
  canPrepare,
  state,
  message,
  onPrepare,
}: {
  hasSavedPositiveWorkHour: boolean
  canPrepare: boolean
  state: 'idle' | 'checking' | 'missing' | 'error'
  message: string
  onPrepare: () => void
}) {
  const checking = state === 'checking'
  return (
    <div className='flex flex-col gap-3 border-t px-4 py-4 sm:px-5'>
      <div className='min-w-0'>
        <div className='text-sm font-medium'>写日报</div>
        <div className='text-muted-foreground mt-1 text-xs'>
          {hasSavedPositiveWorkHour
            ? '已保存有效工时，点击后将读取 OA 数据并生成日报草稿。'
            : '点击后会先检查 OA 工时；没有有效工时时再提示你补充。'}
        </div>
      </div>
      <div className='flex flex-wrap items-center gap-2'>
        <Button
          size='sm'
          onClick={onPrepare}
          disabled={!canPrepare || checking}
        >
          {checking ? (
            <LoaderCircle className='animate-spin' />
          ) : (
            <FileText data-icon='inline-start' />
          )}
          {checking ? '正在生成日报' : '写日报'}
        </Button>
      </div>
      {checking ? (
        <div className='bg-muted/30 text-muted-foreground rounded-md border px-3 py-2 text-xs'>
          正在检查今日工时并整理日报草稿，请稍候。
        </div>
      ) : message ? (
        <div
          className={cn(
            'rounded-md border px-3 py-2 text-xs',
            state === 'missing'
              ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          )}
        >
          {message}
        </div>
      ) : null}
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
  onSaved: (key: string, workHour: number) => void
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
          sourceFingerprint: options.sourceFingerprint,
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

      onSaved(selectedItem.key, Number(form.workHour))
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
