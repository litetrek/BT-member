// Pure, client-safe: the lantern name rule. A lantern needs at least one of 中文名稱
// (name_zh) or English name (name_en). When only one is given, the server asks Claude
// for the other on save (lib/inventoryTranslate.js).
//
// name_zh is NOT NULL in the database and is what most screens show, so when only the
// English name is known (or translation failed) name_zh temporarily holds the English
// text. That placeholder is recognised later (same as name_en, no Chinese characters)
// and translated again on the next save, so a failed translation heals itself.

const CJK = /[㐀-鿿豈-﫿]/

export function hasChinese(s) {
  return CJK.test(String(s ?? ''))
}

// Returns { name_zh, name_en, missing } or { error }.
//   missing: 'en' — only Chinese given, translate to English
//            'zh' — only English given (name_zh is a placeholder), translate to Chinese
//            null — both present
export function normalizeLanternNames(zhIn, enIn) {
  const zh = String(zhIn ?? '').trim()
  const en = String(enIn ?? '').trim()
  if (!zh && !en) return { error: '請至少填寫一個名稱（中文或英文）Enter a Chinese or English name' }
  if (zh.length > 200 || en.length > 200) return { error: '名稱太長（最多 200 字）Name is too long' }
  // English typed into the Chinese field (older records, e.g. "Seaweed"): use it as the
  // English name and translate it into Chinese.
  if (!en) return hasChinese(zh) ? { name_zh: zh, name_en: null, missing: 'en' } : { name_zh: zh, name_en: zh, missing: 'zh' }
  if (!zh || (zh === en && !hasChinese(zh))) return { name_zh: en, name_en: en, missing: 'zh' }
  return { name_zh: zh, name_en: en, missing: null }
}
