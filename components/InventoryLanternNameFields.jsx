// Lantern name inputs shared by every lantern form — 現場新增 (field mode New), 一般新增
// (/inventory/lanterns/new) and 編輯 (edit) — so the three can't drift apart again.
// Both values map straight to inv_lantern_lanterns.name_zh / name_en.
// At least one is required (lib/inventoryLanternNames.js); when only one is filled in,
// the server translates it with AI on save and fills in the other.
export function hasLanternName(nameZh, nameEn) {
  return !!(String(nameZh ?? '').trim() || String(nameEn ?? '').trim())
}

export default function InventoryLanternNameFields({
  nameZh, nameEn, onChange, inputCls, labelCls, stacked = false, autoFocus = false,
}) {
  return (
    <div>
    <div className={stacked ? 'space-y-3' : 'grid grid-cols-1 sm:grid-cols-2 gap-4'}>
      <div>
        <label htmlFor="lantern-name-zh" className={labelCls}>
          名稱（中文）Name (ZH)
        </label>
        <input
          id="lantern-name-zh"
          autoFocus={autoFocus}
          value={nameZh ?? ''}
          onChange={(e) => onChange('name_zh', e.target.value)}
          className={inputCls}
        />
      </div>
      <div>
        <label htmlFor="lantern-name-en" className={labelCls}>
          名稱（英文）Name (EN)
        </label>
        <input
          id="lantern-name-en"
          value={nameEn ?? ''}
          onChange={(e) => onChange('name_en', e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
    <p className="mt-1 text-sm text-gray-500">
      <span className="text-red-500">*</span> 至少填一個。只填一個時，儲存後 AI 會自動翻譯另一個。
      <span className="text-gray-400"> Fill in at least one; AI translates the other on save.</span>
    </p>
    </div>
  )
}
