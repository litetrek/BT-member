// Server-only: fill in a lantern's missing name with Claude — 中文 → English or
// English → 繁體中文. Used when a lantern is saved with only one of name_zh / name_en
// (see lib/inventoryLanternNames.js). Never throws: on any failure (no API key, network,
// refusal, odd answer) it returns null and the lantern is saved without the translation.
import Anthropic from '@anthropic-ai/sdk'
import { hasChinese } from '@/lib/inventoryLanternNames'

const client = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 20_000, maxRetries: 1 })
  : null

const SYSTEM = `You translate the display names of decorative lanterns in the inventory of a Chinese lantern festival (shapes such as animals, sea creatures, flowers, coral, shells, balls, zodiac figures, characters).
Translate the name you are given into the requested language. Keep it short and natural, like a museum label: a few words, Title Case for English, Traditional Chinese characters (繁體中文) for Chinese. Keep numbers, colours and sizes. Do not add explanations.
Reply with the translated name only, on one line, with no quotes or punctuation around it.`

function clean(text) {
  return String(text ?? '')
    .split('\n')[0]
    .trim()
    .replace(/^["'“”「」『』]+|["'“”「」『』。.]+$/g, '')
    .trim()
}

// to: 'en' (translate name_zh into English) or 'zh' (translate name_en into Chinese).
export async function translateLanternName(text, to) {
  if (!client || !text) return null
  const target = to === 'zh' ? 'Traditional Chinese (繁體中文)' : 'English'
  try {
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 2000,
      output_config: { effort: 'low' },
      // If the model declines, the API retries on a fallback model in the same call.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: `Translate into ${target}:\n${text}` }],
    })
    if (response.stop_reason === 'refusal') return null
    const answer = clean(response.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))
    if (!answer || answer.length > 100) return null
    // Sanity check: a Chinese name must contain Chinese characters; an English one must not.
    if (to === 'zh' ? !hasChinese(answer) : hasChinese(answer)) return null
    return answer
  } catch (err) {
    console.error('[inventoryTranslate]', err.status ?? '', err.message)
    return null
  }
}

// Fills next.name_zh / next.name_en in place when `missing` says one is absent.
// Returns { field: 'zh' | 'en', ok: boolean } describing what was attempted, or null.
export async function fillMissingLanternName(next, missing) {
  if (missing === 'en') {
    const en = await translateLanternName(next.name_zh, 'en')
    if (en) next.name_en = en
    return { field: 'en', ok: !!en }
  }
  if (missing === 'zh') {
    const zh = await translateLanternName(next.name_en, 'zh')
    if (zh) next.name_zh = zh
    return { field: 'zh', ok: !!zh }
  }
  return null
}
