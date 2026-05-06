import { LocalDate } from '@js-joda/core'
import { useEffect, useState } from 'react'
import { dateFromDays, daysUntil } from './dateUtils'

export function ExpiryDateInput({
  value,
  onChange,
  label = 'Expiry date',
}: {
  value: string
  onChange: (date: string) => void
  label?: string
}) {
  const [daysValue, setDaysValue] = useState('')

  // sync days display when value changes externally
  useEffect(() => {
    setDaysValue(value ? String(daysUntil(LocalDate.parse(value.slice(0, 10)))) : '')
  }, [value])

  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="date"
          value={value}
          style={{ padding: 4 }}
          onChange={e => {
            const v = e.target.value
            onChange(v)
            setDaysValue(v ? String(daysUntil(LocalDate.parse(v.slice(0, 10)))) : '')
          }}
        />
        <input
          type="number"
          value={daysValue}
          placeholder="days from today"
          style={{ width: 60, padding: 4 }}
          onChange={e => {
            setDaysValue(e.target.value)
            const days = parseInt(e.target.value, 10)
            if (!isNaN(days)) onChange(dateFromDays(days))
          }}
        />
        <span style={{ fontSize: 12, color: '#888' }}>days from today</span>
      </div>
    </div>
  )
}
