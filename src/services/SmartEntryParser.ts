import { INCOME_KEYWORDS } from '@/constants/categorization-keywords'

export interface ParsedEntry {
  amount: number | null
  description: string
  type: 'expense' | 'income'
}

const AMOUNT_PATTERN = /(?:₹|rs\.?|inr)?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*(?:₹|rs\.?|inr)?/i

/**
 * §3 SmartEntryInput: parses free text like "250 tea", "900 petrol",
 * "8000 EMI" → amount, inferred type, suggested category (category
 * suggestion is a separate, async call — see CategorizationService, since
 * it needs to read transaction history).
 */
export const SmartEntryParser = {
  parse(input: string): ParsedEntry {
    const trimmed = input.trim()
    const match = trimmed.match(AMOUNT_PATTERN)

    const amount = match ? Number(match[1].replace(/,/g, '')) : null
    const description = (
      match
        ? trimmed.slice(0, match.index) + trimmed.slice(match.index! + match[0].length)
        : trimmed
    )
      .replace(/\s+/g, ' ')
      .trim()

    const lower = description.toLowerCase()
    const type: ParsedEntry['type'] = INCOME_KEYWORDS.some((kw) => lower.includes(kw))
      ? 'income'
      : 'expense'

    return {
      amount: amount !== null && amount > 0 ? amount : null,
      description,
      type,
    }
  },
}
