import {
  CloudSun,
  Droplets,
  LoaderCircle,
  MapPin,
  Wind,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { IconFrame } from './primitives'
import { formatNumber } from './shared'
import { formatTemperature, type WeatherResult } from './weather-data'

export function WeatherToolCard({ weather }: { weather: WeatherResult }) {
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

export function WeatherToolLoadingCard({ location }: { location?: string }) {
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
