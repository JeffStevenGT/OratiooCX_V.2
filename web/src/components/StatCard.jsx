export default function StatCard({ title, value, subtitle, icon: Icon, color = 'indigo' }) {
  const colorClasses = {
    indigo: 'border-l-4 border-[#0a6ea9] bg-white',
    violet: 'border-l-4 border-[#0a6ea9] bg-white',
    emerald: 'border-l-4 border-emerald-500 bg-white',
    amber: 'border-l-4 border-amber-500 bg-white',
  }

  const iconColors = {
    indigo: 'text-[#0a6ea9] bg-[#e6f3fb]',
    violet: 'text-[#0a6ea9] bg-[#e6f3fb]',
    emerald: 'text-emerald-600 bg-emerald-100',
    amber: 'text-amber-600 bg-amber-100',
  }

  return (
    <div
      className={`${colorClasses[color] || colorClasses.indigo} rounded-xl p-5 border border-oratioo-border shadow-sm`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-oratioo-gray uppercase tracking-wider mb-1">{title}</p>
          <p className="text-2xl font-bold text-oratioo-dark">{value ?? '—'}</p>
          {subtitle && <p className="text-xs text-oratioo-gray mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-2.5 rounded-lg ${iconColors[color] || iconColors.indigo}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </div>
  )
}
