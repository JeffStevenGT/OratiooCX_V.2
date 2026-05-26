import { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

function getWeekNumber(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
}

function generateWeeks(count = 12) {
  const weeks = []
  const today = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i * 7)
    const weekNum = getWeekNumber(d)
    const year = d.getFullYear()
    const monday = new Date(d)
    monday.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const label = `Sem ${weekNum} — ${monday.toLocaleDateString('es', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}`
    weeks.push({ value: `${year}-W${String(weekNum).padStart(2, '0')}`, label })
  }
  return weeks
}

export default function WeekSelector({ onChange }) {
  const [weeks] = useState(generateWeeks)
  const [selected, setSelected] = useState(weeks[0]?.value || '')

  useEffect(() => {
    onChange?.(selected)
  }, [selected])

  return (
    <div className="relative">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="input-field appearance-none pr-10 cursor-pointer bg-white text-sm"
      >
        {weeks.map((w) => (
          <option key={w.value} value={w.value}>
            {w.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-oratioo-gray pointer-events-none"
      />
    </div>
  )
}
