type DailyReportConfirmationResult = {
  status?: string
}

export function isDailyReportConfirmationAccepted(
  response: DailyReportConfirmationResult
) {
  return response.status === 'ACCEPTED'
}
