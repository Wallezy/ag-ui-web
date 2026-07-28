import { useCallback, useEffect, useState } from 'react'
import { Copy, Info, LoaderCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { loadAgentHealth } from './api'
import {
  hasBackendDiagnostics,
  parseBackendDiagnostics,
  type BackendDiagnostics,
} from './development-diagnostics-data'

export type CurrentTaskDiagnostics = {
  traceId: string | null
  taskId: string | null
  taskVersion: number
  schemaVersion: 2 | 3 | null
}

export function DevelopmentDiagnostics({
  task,
}: {
  task: CurrentTaskDiagnostics
}) {
  const [open, setOpen] = useState(false)
  const [availability, setAvailability] = useState<
    'checking' | 'supported' | 'unsupported' | 'unknown'
  >('checking')
  const [loading, setLoading] = useState(false)
  const [diagnostics, setDiagnostics] = useState<BackendDiagnostics | null>(
    null
  )
  const [failed, setFailed] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setFailed(false)
    void loadAgentHealth()
      .then((health) => {
        if (!hasBackendDiagnostics(health)) {
          setAvailability('unsupported')
          setDiagnostics(null)
          setFailed(false)
          return
        }
        const parsed = parseBackendDiagnostics(health)
        setDiagnostics(parsed)
        setAvailability(parsed === null ? 'unsupported' : 'supported')
        setFailed(parsed === null)
      })
      .catch(() => {
        setAvailability('unknown')
        setFailed(true)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (availability === 'unsupported') {
      setOpen(false)
    }
  }, [availability])

  useEffect(() => {
    if (open) load()
  }, [load, open])

  if (availability === 'checking' || availability === 'unsupported') {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size='sm' variant='ghost' aria-label='查看运行诊断'>
          <Info />
          <span className='hidden sm:inline'>诊断</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>运行诊断</DialogTitle>
          <DialogDescription>
            开发稳定环境的功能状态与公开追踪信息
          </DialogDescription>
        </DialogHeader>

        {loading && !diagnostics ? (
          <div className='text-muted-foreground flex items-center gap-2 text-sm'>
            <LoaderCircle className='animate-spin' />
            正在读取
          </div>
        ) : failed || !diagnostics ? (
          <div className='flex items-center justify-between gap-3'>
            <span className='text-destructive text-sm'>诊断信息暂不可用</span>
            <Button
              size='sm'
              variant='outline'
              onClick={load}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : undefined} />
              重试
            </Button>
          </div>
        ) : (
          <dl className='grid grid-cols-[minmax(7rem,auto)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm'>
            <DiagnosticRow label='状态' value={diagnostics.status} />
            <DiagnosticRow
              label='Profile'
              value={diagnostics.activeProfiles.join(', ') || '未声明'}
            />
            <DiagnosticRow
              label='事件 schema'
              value={String(diagnostics.publicEventSchemaVersion ?? '未知')}
            />
            <DiagnosticRow
              label='TaskState schema'
              value={String(diagnostics.taskStateSchemaVersion ?? '未知')}
            />
            <DiagnosticRow
              label='校准执行'
              value={
                diagnostics.calibrationExecutionEligible === true
                  ? '允许'
                  : '关闭'
              }
            />
            <DiagnosticRow
              label='未分类失败'
              value={
                diagnostics.agentRuntimeErrorCount === null
                  ? '未知'
                  : diagnostics.agentRuntimeErrorCount === 0
                    ? '0（正常）'
                    : `${diagnostics.agentRuntimeErrorCount}（需排查日志）`
              }
            />
            <DiagnosticRow
              label='traceId'
              value={task.traceId ?? '当前会话暂无'}
              copyable={task.traceId !== null}
            />
            <DiagnosticRow
              label='taskId'
              value={task.taskId ?? '当前会话暂无'}
            />
            <DiagnosticRow
              label='taskVersion'
              value={
                task.taskVersion >= 0
                  ? String(task.taskVersion)
                  : '当前会话暂无'
              }
            />
          </dl>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DiagnosticRow({
  label,
  value,
  copyable = false,
}: {
  label: string
  value: string
  copyable?: boolean
}) {
  return (
    <>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='flex min-w-0 items-start gap-1 font-mono text-xs break-all'>
        <span className='min-w-0 flex-1'>{value}</span>
        {copyable ? (
          <button
            type='button'
            className='hover:bg-muted focus-visible:ring-ring inline-flex size-6 shrink-0 items-center justify-center rounded-sm focus-visible:ring-2 focus-visible:outline-none'
            aria-label={`复制${label}`}
            title={`复制${label}`}
            onClick={() => void navigator.clipboard.writeText(value)}
          >
            <Copy className='size-3.5' />
          </button>
        ) : null}
      </dd>
    </>
  )
}
