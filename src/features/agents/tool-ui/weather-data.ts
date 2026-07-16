import {
  formatNumber,
  isRecord,
  parseJson,
  readNumber,
  readString,
} from './shared'

export type WeatherResult = {
  temperature: number
  feelsLike: number
  humidity: number
  windSpeed: number
  windGust: number
  conditions: string
  location: string
}

export function parseWeatherResult(result: unknown): WeatherResult | undefined {
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

export function readLocation(args: unknown) {
  const value = typeof args === 'string' ? parseJson(args) : args
  return isRecord(value) ? readString(value.location) : undefined
}

export function formatTemperature(value: number) {
  return `${formatNumber(value)}°C`
}
