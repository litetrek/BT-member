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
    <div className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className={`text-2xl text-blue-600 ti ${activity.icon}`} />
        <h3 className="font-semibold text-gray-900 text-sm">{activity.name}</h3>
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

      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>
            {lang === 'en'
              ? `${done}/${total} tasks done`
              : `${done}/${total} 個任務已完成`}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(activity) }}
            className="text-xs text-blue-600 hover:underline"
          >
            {t(lang, 'Edit', '編輯')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(activity.id) }}
            className="text-xs text-red-500 hover:underline"
          >
            {t(lang, 'Delete', '刪除')}
          </button>
        </div>
      )}
    </div>
  )
}
