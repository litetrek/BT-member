export default function StatusBadge({ status, dueDate }) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const isOverdue =
    status !== 'done' && dueDate && new Date(dueDate) < today

  const resolved = isOverdue ? 'overdue' : status

  const styles = {
    open:        'bg-gray-100 text-gray-600',
    in_progress: 'bg-amber-100 text-amber-700',
    done:        'bg-green-100 text-green-700',
    overdue:     'bg-red-100 text-red-700',
  }

  const labels = {
    open:        'Open',
    in_progress: 'In Progress',
    done:        'Done',
    overdue:     'Overdue',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles[resolved] ?? styles.open}`}>
      {labels[resolved] ?? resolved}
    </span>
  )
}
