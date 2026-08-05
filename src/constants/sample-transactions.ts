import type { CreateTransactionInput } from "@/services/TransactionService";

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

/** A realistic-looking spread across categories/accounts/dates so a new
 * user exploring the app immediately sees search, filters, and the
 * categorization engine doing something. Deletable individually like any
 * other transaction (§9: onboarding sample data must be removable). */
export const SAMPLE_TRANSACTIONS: CreateTransactionInput[] = [
  {
    amount: 45000,
    description: "Salary",
    type: "income",
    categoryId: "cat-salary",
    accountId: "acc-bank",
    transactionDate: daysAgo(28),
  },
  {
    amount: 250,
    description: "Tea and snacks",
    type: "expense",
    categoryId: "cat-food",
    accountId: "acc-cash",
    transactionDate: daysAgo(27),
  },
  {
    amount: 1800,
    description: "Petrol",
    type: "expense",
    categoryId: "cat-fuel",
    accountId: "acc-upi",
    transactionDate: daysAgo(25),
  },
  {
    amount: 899,
    description: "Netflix subscription",
    type: "expense",
    categoryId: "cat-entertainment",
    accountId: "acc-credit-card",
    transactionDate: daysAgo(24),
  },
  {
    amount: 3200,
    description: "Grocery shopping",
    type: "expense",
    categoryId: "cat-shopping",
    accountId: "acc-upi",
    transactionDate: daysAgo(21),
  },
  {
    amount: 1200,
    description: "Electricity bill",
    type: "expense",
    categoryId: "cat-utilities",
    accountId: "acc-bank",
    transactionDate: daysAgo(19),
  },
  {
    amount: 450,
    description: "Zomato order",
    type: "expense",
    categoryId: "cat-food-delivery",
    accountId: "acc-upi",
    transactionDate: daysAgo(17),
  },
  {
    amount: 8000,
    description: "Car EMI",
    type: "expense",
    categoryId: "cat-emi-loans",
    accountId: "acc-bank",
    transactionDate: daysAgo(15),
  },
  {
    amount: 600,
    description: "Pharmacy",
    type: "expense",
    categoryId: "cat-health",
    accountId: "acc-cash",
    transactionDate: daysAgo(12),
  },
  {
    amount: 350,
    description: "Coffee with friends",
    type: "expense",
    categoryId: "cat-food",
    accountId: "acc-cash",
    transactionDate: daysAgo(10),
  },
  {
    amount: 2500,
    description: "Shoes",
    type: "expense",
    categoryId: "cat-shopping",
    accountId: "acc-credit-card",
    transactionDate: daysAgo(8),
  },
  {
    amount: 1500,
    description: "Movie night",
    type: "expense",
    categoryId: "cat-entertainment",
    accountId: "acc-upi",
    transactionDate: daysAgo(6),
  },
  {
    amount: 5000,
    description: "Freelance payment received",
    type: "income",
    categoryId: "cat-salary",
    accountId: "acc-bank",
    transactionDate: daysAgo(4),
  },
  {
    amount: 300,
    description: "Tea",
    type: "expense",
    categoryId: "cat-food",
    accountId: "acc-cash",
    transactionDate: daysAgo(2),
  },
  {
    amount: 700,
    description: "Swiggy order",
    type: "expense",
    categoryId: "cat-food-delivery",
    accountId: "acc-upi",
    transactionDate: daysAgo(1),
  },
];
