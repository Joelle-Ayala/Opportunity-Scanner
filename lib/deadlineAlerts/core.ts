export const DEADLINE_REMINDER_DAY_OPTIONS = [14, 7, 1] as const;

export type DeadlineReminderDay = (typeof DEADLINE_REMINDER_DAY_OPTIONS)[number];

export function normalizeDeadlineReminderDays(values: readonly number[]): DeadlineReminderDay[] {
  const selected = new Set(values);
  return DEADLINE_REMINDER_DAY_OPTIONS.filter((day) => selected.has(day));
}

export function deadlineReminderLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

