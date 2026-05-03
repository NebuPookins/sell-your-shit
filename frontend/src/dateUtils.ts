import { LocalDate, ChronoUnit } from '@js-joda/core'

export function daysUntil(date: LocalDate): number {
  return LocalDate.now().until(date, ChronoUnit.DAYS)
}

export function dateFromDays(days: number): string {
  return LocalDate.now().plusDays(days).toString()
}
