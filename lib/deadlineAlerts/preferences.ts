import {
  dashboardInsert,
  dashboardSelectOne,
  dashboardUpdate
} from "../dashboard/rest.ts";
import { normalizeDeadlineReminderDays, type DeadlineReminderDay } from "./core.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AccountRow = { id: string };
type AlertPreferencesRow = {
  customer_account_id: string;
  email_enabled: boolean;
  new_opportunity_email_enabled: boolean;
  deadline_email_enabled: boolean;
  deadline_reminder_days: number[];
  unsubscribed_at: string | null;
  updated_at: string;
};

export type CustomerAlertPreferences = {
  accountId: string;
  emailEnabled: boolean;
  newOpportunityEmailEnabled: boolean;
  deadlineEmailEnabled: boolean;
  deadlineReminderDays: DeadlineReminderDay[];
  unsubscribedAt: string | null;
  updatedAt: string;
};

function publicPreferences(row: AlertPreferencesRow): CustomerAlertPreferences {
  return {
    accountId: row.customer_account_id,
    emailEnabled: row.email_enabled,
    newOpportunityEmailEnabled: row.new_opportunity_email_enabled,
    deadlineEmailEnabled: row.deadline_email_enabled,
    deadlineReminderDays: normalizeDeadlineReminderDays(row.deadline_reminder_days),
    unsubscribedAt: row.unsubscribed_at,
    updatedAt: row.updated_at
  };
}

async function accountForUser(authUserId: string): Promise<AccountRow> {
  if (!UUID_PATTERN.test(authUserId)) throw new Error("A valid authenticated user ID is required.");
  const account = await dashboardSelectOne<AccountRow>("customer_accounts", {
    select: "id",
    auth_user_id: `eq.${authUserId}`
  });
  if (!account) throw new Error("Customer account not found.");
  return account;
}

export async function loadCustomerAlertPreferences(authUserId: string): Promise<CustomerAlertPreferences> {
  const account = await accountForUser(authUserId);
  let row = await dashboardSelectOne<AlertPreferencesRow>("customer_alert_preferences", {
    select: "customer_account_id,email_enabled,new_opportunity_email_enabled,deadline_email_enabled,deadline_reminder_days,unsubscribed_at,updated_at",
    customer_account_id: `eq.${account.id}`
  });
  if (!row) {
    row = await dashboardInsert<AlertPreferencesRow>("customer_alert_preferences", {
      customer_account_id: account.id
    });
  }
  if (!row) throw new Error("Alert preferences could not be created.");
  return publicPreferences(row);
}

export async function updateCustomerAlertPreferences(
  authUserId: string,
  input: {
    emailEnabled: boolean;
    newOpportunityEmailEnabled: boolean;
    deadlineEmailEnabled: boolean;
    deadlineReminderDays: readonly number[];
  }
): Promise<CustomerAlertPreferences> {
  const current = await loadCustomerAlertPreferences(authUserId);
  const days = normalizeDeadlineReminderDays(input.deadlineReminderDays);
  const now = new Date().toISOString();
  const row = await dashboardUpdate<AlertPreferencesRow>(
    "customer_alert_preferences",
    { customer_account_id: `eq.${current.accountId}` },
    {
      email_enabled: input.emailEnabled,
      new_opportunity_email_enabled: input.newOpportunityEmailEnabled,
      deadline_email_enabled: input.deadlineEmailEnabled && days.length > 0,
      deadline_reminder_days: days,
      unsubscribed_at: input.emailEnabled ? null : now,
      updated_at: now
    }
  );
  if (!row) throw new Error("Alert preferences could not be updated.");
  return publicPreferences(row);
}

export async function unsubscribeCustomerAlerts(accountId: string): Promise<void> {
  if (!UUID_PATTERN.test(accountId)) throw new Error("A valid customer account ID is required.");
  const now = new Date().toISOString();
  const row = await dashboardUpdate<AlertPreferencesRow>(
    "customer_alert_preferences",
    { customer_account_id: `eq.${accountId}` },
    { email_enabled: false, unsubscribed_at: now, updated_at: now }
  );
  if (!row) throw new Error("Alert preferences were not found.");
}
