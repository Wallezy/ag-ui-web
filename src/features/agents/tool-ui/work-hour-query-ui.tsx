import { AlertTriangle, Clock3 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { IconFrame, OaMetric } from './primitives'
import { formatDateRange, formatDateText, formatNumber } from './shared'
import type { UserWorkHoursResult } from './work-hour-query-data'

export function OaUserWorkHoursCard({
  result,
  message,
}: {
  result: UserWorkHoursResult
  message?: string
}) {
  const title = result.targetUserName
    ? `${result.targetUserName}的登记工时`
    : '登记工时查询'
  const description =
    message ||
    (result.recordCount
      ? `已汇总 ${result.recordCount} 条有效工时记录。`
      : '该日期范围内没有已登记工时。')
  const breakdown = result.typeBreakdown.slice(0, 6)
  const details = result.details.slice(0, 8)

  return (
    <Card className='w-full max-w-2xl gap-4 rounded-lg py-4 shadow-none'>
      <CardHeader className='gap-3 px-4 sm:px-5'>
        <div className='flex items-start gap-3'>
          <IconFrame
            icon={result.complete ? Clock3 : AlertTriangle}
            tone={result.complete ? 'default' : 'warning'}
          />
          <div className='min-w-0 flex-1'>
            <div className='flex min-w-0 flex-wrap items-center gap-2'>
              <CardTitle className='truncate text-base'>{title}</CardTitle>
              <Badge variant={result.complete ? 'secondary' : 'outline'}>
                {result.complete ? '查询完整' : '结果不完整'}
              </Badge>
            </div>
            <CardDescription className='mt-1'>{description}</CardDescription>
          </div>
          <CardAction>
            <Badge variant='outline'>{result.recordCount} 条</Badge>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent className='flex flex-col gap-3 px-4 sm:px-5'>
        <div className='grid gap-2 sm:grid-cols-3'>
          <OaMetric
            label='合计工时'
            value={`${formatNumber(result.totalWorkHours)} 小时`}
          />
          <OaMetric
            label='有记录日期'
            value={`${formatNumber(result.activeDayCount, 0)} 天`}
          />
          <OaMetric
            label='查询范围'
            value={formatDateRange(result.dateRange) || '-'}
          />
        </div>

        {breakdown.length ? (
          <div className='flex flex-wrap gap-2' aria-label='工时构成'>
            {breakdown.map((item) => (
              <Badge key={item.typeName} variant='outline'>
                {item.typeName} {formatNumber(item.workHours)} 小时
              </Badge>
            ))}
          </div>
        ) : null}

        {details.length ? (
          <div className='border-t pt-3'>
            <div className='mb-2 text-sm font-medium'>工作内容</div>
            <div className='divide-y'>
              {details.map((detail, index) => (
                <div
                  key={`${detail.workDate || 'date'}-${detail.title || detail.executionDesc || 'detail'}-${index}`}
                  className='flex flex-col gap-1 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4'
                >
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 text-sm'>
                      {detail.workDate ? (
                        <span className='text-muted-foreground'>
                          {formatDateText(detail.workDate)}
                        </span>
                      ) : null}
                      {detail.projectName ? (
                        <span className='text-muted-foreground'>
                          {detail.projectName}
                        </span>
                      ) : null}
                      {detail.typeName ? (
                        <Badge variant='outline'>{detail.typeName}</Badge>
                      ) : null}
                    </div>
                    {detail.title ? (
                      <div className='mt-1 text-sm font-medium break-words'>
                        {detail.title}
                      </div>
                    ) : null}
                    {detail.executionDesc || detail.workCategory ? (
                      <div className='text-muted-foreground mt-1 text-sm break-words'>
                        {detail.executionDesc || detail.workCategory}
                      </div>
                    ) : null}
                  </div>
                  <div className='shrink-0 text-sm font-medium'>
                    {formatNumber(detail.workHours)} 小时
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {!result.complete ? (
          <div className='flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm'>
            <AlertTriangle className='mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300' />
            <span className='text-muted-foreground'>
              部分异常记录未纳入统计，当前结果可能不完整。
            </span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
