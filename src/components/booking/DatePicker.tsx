'use client'

import { useState } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'

export interface BookingDatePickerProps {
  onDateSelect: (date: string) => void // receives "YYYY-MM-DD"
}

export default function BookingDatePicker({ onDateSelect }: BookingDatePickerProps) {
  const [selected, setSelected] = useState<Date | undefined>(undefined)

  const today = new Date()
  const maxDate = new Date(today)
  maxDate.setDate(today.getDate() + 30)

  function handleSelect(date: Date | undefined) {
    if (!date) return
    setSelected(date)
    // toLocaleDateString('sv') outputs "YYYY-MM-DD" (Swedish locale uses ISO format)
    const formatted = date.toLocaleDateString('sv')
    onDateSelect(formatted)
  }

  return (
    <div className="dms-calendar">
      <style>{`
        .dms-calendar .rdp-root {
          --rdp-accent-color: #0B0B0C;
          --rdp-accent-background-color: #E0E0DC;
          --rdp-day_button-border-radius: 0;
          --rdp-today-color: #0B0B0C;
        }
        .dms-calendar .rdp-caption_label {
          font-family: var(--font-display, 'Big Shoulders Display', sans-serif);
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dms-calendar .rdp-day_button:hover:not(:disabled) {
          background-color: #E0E0DC;
        }
      `}</style>
      <DayPicker
        mode="single"
        selected={selected}
        onSelect={handleSelect}
        disabled={[{ before: today }, { after: maxDate }]}
      />
    </div>
  )
}
