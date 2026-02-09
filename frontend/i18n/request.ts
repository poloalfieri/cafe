import {getRequestConfig} from 'next-intl/server'
import { headers } from 'next/headers'

const locales = ['es', 'en'] as const
const defaultLocale = 'es'

function normalizeLocale(input: string | undefined) {
  if (!input) return defaultLocale
  const lower = input.toLowerCase()
  if ((locales as readonly string[]).includes(lower)) return lower
  const base = lower.split('-')[0]
  if ((locales as readonly string[]).includes(base)) return base
  return defaultLocale
}

function getLocaleFromAcceptLanguage(headerValue: string | null | undefined) {
  if (!headerValue) return defaultLocale
  const parts = headerValue.split(',')
  for (const part of parts) {
    const tag = part.split(';')[0]?.trim()
    if (!tag) continue
    const normalized = normalizeLocale(tag)
    if ((locales as readonly string[]).includes(normalized)) return normalized
  }
  return defaultLocale
}

export default getRequestConfig(async ({locale}) => {
  const headersList = await headers()
  const headerLocale = getLocaleFromAcceptLanguage(headersList.get('accept-language'))
  const resolvedLocale = locale
    ? normalizeLocale(locale as string)
    : headerLocale
  let messages
  try {
    messages = (await import(`../messages/${resolvedLocale}.json`)).default
  } catch {
    messages = (await import(`../messages/${defaultLocale}.json`)).default
  }
  return {
    locale: resolvedLocale,
    messages
  }
})
