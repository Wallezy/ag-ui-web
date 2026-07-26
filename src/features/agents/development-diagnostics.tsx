import { useEffect, useState } from 'react'
import { Info, LoaderCircle, RefreshCw } from 'lucide-react'
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
  displayRevision,
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
  const [loading, setLoading] = useState(false)
  const [diagnostics, setDiagnostics] = useState<BackendDiagnostics | null>(
    null
  )
  const [failed, setFailed] = useState(false)

  const load = () => {
    setLoading(true)
    setFailed(false)
    void loadAgentHealth()
      .then((health) => {
        const parsed = parseBackendDiagnostics(health)
        setDiagnostics(parsed)
        setFailed(parsed === null)
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (open) load()
  }, [open])

  const frontendRevision =
    import.meta.env.VITE_FRONTEND_REVISION ?? 'unavailable'

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
            开发稳定环境的版本与公开追踪信息
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
            <DiagnosticRow label='发布阶段' value={diagnostics.rolloutStage} />
            <DiagnosticRow
              label='后端 SHA'
              value={displayRevision(diagnostics.backendRevision)}
            />
            <DiagnosticRow
              label='前端 SHA'
              value={displayRevision(frontendRevision)}
            />
            <DiagnosticRow
              label='配对前端 SHA'
              value={displayRevision(diagnostics.expectedFrontendRevision)}
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
              label='traceId'
              value={task.traceId ?? '当前会话暂无'}
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

function DiagnosticRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className='text-muted-foreground'>{label}</dt>
      <dd className='min-w-0 font-mono text-xs break-all'>{value}</dd>
    </>
  )
}
