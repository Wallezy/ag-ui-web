import { AlertTriangle, ClipboardList } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  workItemQueryPresentation,
  type WorkItemsResult,
} from '../work-items-result'
import { IconFrame, OaMetric } from './primitives'
import {
  formatDateRange,
  formatDateText,
  formatWorkItemType,
  readText,
} from './shared'

export function OaWorkItemsCard({
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
