/**
 * §6 Smart categorization priority: exact description match → favorite
 * match → learned historical match → keyword dictionary → AI suggestion →
 * manual selection.
 *
 * This is the keyword-dictionary tier — the fallback before asking the user
 * outright. "AI suggestion" (§6) is explicitly out of scope here: §7 states
 * the Intelligence Engine "runs entirely on local data; no internet, no
 * cloud processing, no external AI services in v1.0," and Categorization is
 * itself listed as an Intelligence Engine module with its own confidence
 * machinery (§7) — that tier is Phase 9's to build. Phase 1 implements
 * exact/favorite/historical/keyword and asks the user when none match with
 * enough confidence.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'cat-food': [
    'tea',
    'coffee',
    'lunch',
    'dinner',
    'breakfast',
    'restaurant',
    'cafe',
    'snack',
    'chai',
  ],
  'cat-fuel': ['petrol', 'diesel', 'fuel', 'gas station', 'cng'],
  'cat-shopping': ['amazon', 'flipkart', 'myntra', 'mall', 'clothes', 'shoes', 'shopping'],
  'cat-utilities': [
    'electricity',
    'water bill',
    'gas bill',
    'wifi',
    'broadband',
    'recharge',
    'dth',
  ],
  'cat-food-delivery': ['zomato', 'swiggy', 'food delivery', 'delivery'],
  'cat-health': ['pharmacy', 'medicine', 'doctor', 'hospital', 'clinic', 'medical'],
  'cat-entertainment': ['movie', 'netflix', 'spotify', 'prime video', 'concert', 'game'],
  'cat-emi-loans': ['emi', 'loan', 'installment'],
  'cat-salary': ['salary', 'paycheck', 'stipend'],
  'cat-transfers': ['transfer', 'sent to', 'received from'],
}

/** Words that flip the inferred transaction type from expense to income
 * when they appear in Smart Entry free text (e.g. "5000 salary received"). */
export const INCOME_KEYWORDS = [
  'salary',
  'received',
  'refund',
  'credited',
  'income',
  'bonus',
  'cashback',
]
