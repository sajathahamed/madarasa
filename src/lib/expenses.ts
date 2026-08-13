import type { ExpenseCategory } from "@/types/database";

export const EXPENSE_CATEGORIES: {
  value: ExpenseCategory;
  label: string;
}[] = [
  { value: "salary", label: "Salary / staff pay" },
  { value: "utilities", label: "Utilities (electricity / water)" },
  { value: "food_kitchen", label: "Food / kitchen" },
  { value: "maintenance", label: "Maintenance / repairs" },
  { value: "books_stationery", label: "Books / stationery" },
  { value: "transport", label: "Transport" },
  { value: "charity_zakat", label: "Charity / zakat outflow" },
  { value: "miscellaneous", label: "Miscellaneous" },
];

export function expenseCategoryLabel(category: string): string {
  return (
    EXPENSE_CATEGORIES.find((c) => c.value === category)?.label ?? category
  );
}
