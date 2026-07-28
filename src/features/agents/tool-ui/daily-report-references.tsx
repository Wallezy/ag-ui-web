import { CornerDownRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { DailyReportReferences } from './daily-report-model'

export function DailyReportReferencesView({
  references,
  showUserContent = true,
  title = '本次草稿引用',
}: {
  references: DailyReportReferences
  showUserContent?: boolean
  title?: string
}) {
  const hasUserContent = showUserContent && references.userContent.length > 0
  if (!hasUserContent && !references.oaSources.length) {
    return null
  }

  return (
    <div className='bg-muted/20 rounded-md border px-3 py-3 text-sm'>
      <div className='flex items-center gap-2 font-medium'>
        <CornerDownRight className='text-primary size-4' />
        {title}
      </div>
      {hasUserContent ? (
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
