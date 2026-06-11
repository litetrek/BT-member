export default function Avatar({ name, avatarUrl, size = 'md' }) {
  const dim = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  const initials = (name ?? '?')
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${dim} rounded-full object-cover`}
      />
    )
  }

  return (
    <span
      className={`${dim} rounded-full bg-blue-100 text-blue-700 font-medium flex items-center justify-center`}
    >
      {initials}
    </span>
  )
}
