export default function Spinner({ size = 'md' }) {
  const dim = size === 'sm' ? 'w-4 h-4 border' : 'w-8 h-8 border-2'
  return (
    <div className={`${dim} border-gray-200 border-t-blue-500 rounded-full animate-spin`} />
  )
}
