// Lantern name inputs shared by every lantern form — 現場新增 (field mode New), 一般新增
// (/inventory/lanterns/new) and 編輯 (edit) — so the three can't drift apart again.
// Both values map straight to inv_lantern_lanterns.name_zh / name_en.
//   name_zh — required (server rejects a blank one too)
//   name_en — optional; '' is saved as NULL
export default function InventoryLanternNameFields({
  nameZh, nameEn, onChange, inputCls, labelCls, stacked = false, autoFocus = false,
}) {
  return (
    <div className={stacked ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
      <div>
        <label htmlFor="lantern-name-zh" className={labelCls}>
          名稱（中文）Name (ZH) <span className="text-red-500">*</span>
        </label>
        <input
          id="lantern-name-zh"
          required
          autoFocus={autoFocus}
          value={nameZh ?? ''}
          onChange={(e) => onChange('name_zh', e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="lantern-name-en" className={labelCls}>
          名稱（英文）Name (EN) <span className="text-gray-400">（選填 optional）</span>
        </label>
        <input
          id="lantern-name-en"
          value={nameEn ?? ''}
          onChange={(e) => onChange('name_en', e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
  )
}
