// Lightweight translation helper. Default language is 'zh' (Traditional Chinese).
// Usage: t(lang, 'English text', '中文文字')
export const t = (lang, en, zh) => lang === 'en' ? en : zh
