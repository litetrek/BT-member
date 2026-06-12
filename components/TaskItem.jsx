import Avatar from './Avatar'
import StatusBadge from './StatusBadge'

export default function TaskItem({ task, currentUserId, userRole, onStatusChange, onEdit, onOpen, highlighted }) {
  const isAssignee = task.assignee_1_id === currentUserId || task.assignee_2_id === currentUserId
  const canCheck = isAssignee
  const canEdit = ['admin', 'lead'].includes(userRole)
  const isDone = task.status === 'done'

  function handleCheck(e) {
    e.stopPropagation()
    if (!canCheck) return
    onStatusChange(task.id, isDone ? 'open' : 'done')
  }

  return (
    <div
      id={`task-${task.id}`}
      onClick={() => onOpen?.(task)}
      className={`bg-white border rounded-lg px-4 py-3 flex items-center gap-3 transition-colors cursor-pointer hover:bg-gray-50 ${
        highlighted ? 'border-blue-400 ring-2 ring-blue-100' : 'border-gray-200'
      }`}
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={handleCheck}
        onClick={(e) => e.stopPropagation()}
        disabled={!canCheck}
        className={`w-4 h-4 rounded accent-blue-600 shrink-0 ${canCheck ? 'cursor-pointer' : 'cursor-default opacity-40'}`}
      />

      <div className="flex-1 min-w-0">
        <p className={`text-sm text-gray-800 truncate ${isDone ? 'line-through text-gray-400' : ''}`}>
          {task.title}
        </p>
        {(task.activity?.name || task.task_type) && (
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            {task.activity?.name}
            {task.activity?.name && task.task_type && task.task_type !== 'general' && (
              <span className="text-gray-300">·</span>
            )}
            {task.task_type && task.task_type !== 'general' && (
              <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                {task.task_type}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={task.status} dueDate={task.due_date} />

        {task.due_date && (
          <span className="text-xs text-gray-400 hidden sm:block">
            {new Date(task.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}

        <div className="flex -space-x-1">
          {task.assignee1 && (
            <Avatar
              name={task.assignee1.name ?? task.assignee1.email}
              avatarUrl={task.assignee1.avatar_url}
              size="sm"
            />
          )}
          {task.assignee2 && (
            <Avatar
              name={task.assignee2.name ?? task.assignee2.email}
              avatarUrl={task.assignee2.avatar_url}
              size="sm"
            />
          )}
        </div>

        {canEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(task) }}
            className="text-gray-400 hover:text-gray-700 ml-1"
            title="Edit task"
          >
            <span className="ti ti-pencil text-sm" />
          </button>
        )}
      </div>
    </div>
  )
}
