import { t } from '@/lib/i18n'

export default function ConfirmDialog({ message, confirmLabel, onConfirm, onCancel, lang = 'zh' }) {
  const label = confirmLabel ?? t(lang, 'Delete', '刪除')
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-lg">
        <p className="text-sm text-gray-800 mb-6">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            {t(lang, 'Cancel', '取消')}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
          >
            {label}
          </button>
        </div>
      </div>
    </div>
  )
}
