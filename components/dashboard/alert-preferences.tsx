import { DEADLINE_REMINDER_DAY_OPTIONS } from "@/lib/deadlineAlerts/core";
import type { CustomerAlertPreferences } from "@/lib/deadlineAlerts/preferences";

export type AlertPreferencesProps = {
  preferences: CustomerAlertPreferences;
  emailVerified: boolean;
};

export function AlertPreferences({ preferences, emailVerified }: AlertPreferencesProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-white" aria-labelledby="alert-preferences-title">
      <div className="border-b border-line px-5 py-4">
        <h2 id="alert-preferences-title" className="text-base font-semibold text-ink">Alert preferences</h2>
        <p className="mt-1 text-sm text-muted">Choose which monitoring emails reach your verified account address.</p>
      </div>
      <form action="/api/dashboard/alert-preferences" method="post" className="grid gap-6 p-5">
        {!emailVerified ? (
          <p role="status" className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Email alerts are paused until your account email is verified.
          </p>
        ) : null}

        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name="emailEnabled"
            value="true"
            defaultChecked={preferences.emailEnabled}
            className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
          />
          <span>
            <span className="block text-sm font-semibold text-ink">Email alerts</span>
            <span className="mt-1 block text-sm leading-6 text-muted">Master switch for all monitoring and deadline emails.</span>
          </span>
        </label>

        <div className="grid gap-4 border-t border-line pt-5 sm:grid-cols-2">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="newOpportunityEmailEnabled"
              value="true"
              defaultChecked={preferences.newOpportunityEmailEnabled}
              className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">New opportunities</span>
              <span className="mt-1 block text-sm leading-6 text-muted">Send an email when monitoring finds a new matching signal.</span>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name="deadlineEmailEnabled"
              value="true"
              defaultChecked={preferences.deadlineEmailEnabled}
              className="mt-1 h-4 w-4 rounded border-line text-accent focus:ring-accent"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">Deadline reminders</span>
              <span className="mt-1 block text-sm leading-6 text-muted">Remind me before active opportunities close.</span>
            </span>
          </label>
        </div>

        <fieldset className="border-t border-line pt-5">
          <legend className="text-sm font-semibold text-ink">Reminder timing</legend>
          <div className="mt-3 flex flex-wrap gap-4">
            {DEADLINE_REMINDER_DAY_OPTIONS.map((day) => (
              <label key={day} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="deadlineReminderDays"
                  value={day}
                  defaultChecked={preferences.deadlineReminderDays.includes(day)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
                />
                {day === 1 ? "1 day before" : `${day} days before`}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <p className="text-xs leading-5 text-muted">
            {preferences.unsubscribedAt ? "Alerts are currently unsubscribed." : "Changes apply before the next delivery claim."}
          </p>
          <button type="submit" className="min-h-11 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0A6871] focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
            Save alert preferences
          </button>
        </div>
      </form>
    </section>
  );
}

