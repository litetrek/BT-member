import Avatar from './Avatar'
import { useLang } from '@/context/LangContext'
import { t } from '@/lib/lang'

export default function ActivityCard({ activity, onEdit, onDelete, isAdmin }) {
  const lang = useLang()
  const tasks = activity.tasks ?? []
  const total = tasks.length
  const done = tasks.filter((tk) => tk.status === 'done').length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <div className="rounded-xl overflow-hidden mb-3">
      {/* Top zone — light blue */}
      <div className="bg-blue-50 px-3.5 pt-3.5 pb-3 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className={`text-2xl text-blue-600 ti ${activity.icon} shrink-0`} />
          <h3 className="font-semibold text-gray-900 text-sm leading-tight">{activity.name}</h3>
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

      {/* Bottom zone — medium blue, admin only */}
      {isAdmin && (
        <div className="bg-blue-200 px-3.5 py-2 flex gap-[10px] items-center">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(activity) }}
            className="bg-white border border-blue-300 text-blue-700 rounded-lg px-3.5 py-1.5 text-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            {t(lang, 'Edit', '編輯')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(activity.id) }}
            className="bg-white border border-red-300 text-red-600 rounded-lg px-3.5 py-1.5 text-sm flex items-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
            {t(lang, 'Delete', '刪除')}
          </button>
        </div>
      )}
    </div>
  )
}
