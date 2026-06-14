import Avatar from './Avatar'

export default function ActivityCard({ activity, onEdit, onDelete, isAdmin }) {
  const tasks = activity.tasks ?? []
  const total = tasks.length
  const done = tasks.filter((tk) => tk.status === 'done').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="bg-blue-50 rounded-xl px-3.5 pt-3.5 pb-3 flex flex-col gap-3 mb-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={`text-2xl text-blue-600 ti ${activity.icon} shrink-0`} />
          <h3 className="font-semibold text-gray-900 text-base leading-tight">{activity.name}</h3>
        </div>
        {isAdmin && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(activity) }}
              className="w-9 h-9 flex items-center justify-center bg-white border border-blue-300 rounded-lg text-base"
            >
              ✏️
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(activity.id) }}
              className="w-9 h-9 flex items-center justify-center bg-white border border-red-300 rounded-lg text-base"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-xs text-gray-500">
        <Avatar name={activity.lead?.name} avatarUrl={activity.lead?.avatar_url} size="sm" />
        <span>{activity.lead?.name ?? '—'}</span>
        {activity.co_lead && (
          <>
            <span className="text-gray-300">·</span>
            <Avatar name={activity.co_lead.name} avatarUrl={activity.co_lead.avatar_url} size="sm" />
            <span>{activity.co_lead.name}</span>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${
              pct > 0 ? 'bg-green-500' : total > 0 ? 'bg-red-400' : 'bg-gray-300'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap">{done} / {total}</span>
      </div>
    </div>
  )
}
