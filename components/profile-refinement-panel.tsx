"use client";

import { FormEvent, useMemo, useState } from "react";
import { CompanyProfile, ProfileFeedbackRecord, ProfileFeedbackKind } from "@/lib/types";
import { ProfileSearchStrategy } from "@/lib/profileRefinement";

type ProfileApiResponse = {
  profile: CompanyProfile;
  search_strategy: ProfileSearchStrategy;
  feedback: ProfileFeedbackRecord[];
};

function splitTerms(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function pillClass(tone: "blue" | "green" | "amber" | "slate" = "slate"): string {
  const tones = {
    slate: "border-line bg-field text-slate-700",
    blue: "border-blue-100 bg-blue-50 text-blue-700",
    green: "border-emerald-100 bg-emerald-50 text-emerald-700",
    amber: "border-amber-100 bg-amber-50 text-amber-800"
  };
  return `inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold ${tones[tone]}`;
}

export function ProfileRefinementPanel({
  scanId,
  initialProfile,
  initialStrategy,
  initialFeedback,
  access
}: {
  scanId: string;
  initialProfile: CompanyProfile;
  initialStrategy: ProfileSearchStrategy;
  initialFeedback: ProfileFeedbackRecord[];
  access?: string;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [strategy, setStrategy] = useState(initialStrategy);
  const [feedback, setFeedback] = useState(initialFeedback);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const feedbackSummary = useMemo(() => {
    const confirmed = feedback.filter((item) => item.feedback_kind === "confirm_profile").length;
    const refinements = feedback.filter((item) =>
      ["refine_profile", "add_focus", "include_term", "change_target_geography", "change_priority_signal"].includes(
        item.feedback_kind
      )
    ).length;
    const exclusions = feedback.filter((item) =>
      ["exclude_lane", "exclude_term", "less_like_this"].includes(item.feedback_kind)
    ).length;
    return { confirmed, refinements, exclusions };
  }, [feedback]);

  async function submitFeedback(input: {
    feedbackKind: ProfileFeedbackKind;
    value?: string;
    reason?: string;
    terms?: string[];
    lanes?: string[];
    targetGeographies?: string[];
    prioritySignals?: string[];
  }) {
    setStatus("saving");
    const accessQuery = access ? `?access=${encodeURIComponent(access)}` : "";
    const response = await fetch(`/api/profile/${scanId}/feedback${accessQuery}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });

    if (!response.ok) {
      setStatus("error");
      return;
    }

    const updated = (await response.json()) as ProfileApiResponse & { feedback: ProfileFeedbackRecord };
    setProfile(updated.profile);
    setStrategy(updated.search_strategy);
    setFeedback((rows) => [...rows, updated.feedback]);
    setStatus("saved");
  }

  async function onSimpleSubmit(
    event: FormEvent<HTMLFormElement>,
    feedbackKind: ProfileFeedbackKind,
    field: "terms" | "lanes" | "targetGeographies" | "prioritySignals" = "terms"
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = String(form.get("value") ?? "");
    const reason = String(form.get("reason") ?? "");
    await submitFeedback({
      feedbackKind,
      value,
      reason,
      [field]: splitTerms(value)
    });
    event.currentTarget.reset();
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-lg border border-line bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Refine This Profile</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              These corrections update future connector queries, scoring, filtering, playbook routing, and report guidance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={pillClass("green")}>Confidence {profile.profile_confidence_score ?? 0}/100</span>
            <span className={pillClass("blue")}>{feedback.length} feedback item(s)</span>
            {status === "saving" ? <span className={pillClass("amber")}>Saving...</span> : null}
            {status === "saved" ? <span className={pillClass("green")}>Saved</span> : null}
            {status === "error" ? <span className={pillClass("amber")}>Could not save</span> : null}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() =>
              submitFeedback({
                feedbackKind: "confirm_profile",
                reason: "User confirmed the inferred opportunity profile."
              })
            }
            className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Looks Right
          </button>
          <div className="rounded-md border border-line bg-field p-3 text-sm text-slate-700">
            <span className="font-semibold text-ink">{feedbackSummary.refinements}</span> refinements saved
          </div>
          <div className="rounded-md border border-line bg-field p-3 text-sm text-slate-700">
            <span className="font-semibold text-ink">{feedbackSummary.exclusions}</span> exclusions saved
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          onSubmit={(event) => onSimpleSubmit(event, "refine_profile", "terms")}
          className="rounded-lg border border-line bg-white p-5"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What They Actually Do</h3>
          <textarea
            name="value"
            required
            rows={4}
            placeholder="Example: teacher hiring, substitute staffing, K-12 HR, applicant tracking"
            className="mt-3 w-full rounded-md border border-line bg-field px-3 py-3 text-sm outline-none focus:border-accent"
          />
          <input
            name="reason"
            placeholder="Optional reason"
            className="mt-3 w-full rounded-md border border-line bg-field px-3 py-3 text-sm outline-none focus:border-accent"
          />
          <button className="mt-3 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
            Save Focus
          </button>
        </form>

        <form
          onSubmit={(event) => onSimpleSubmit(event, "exclude_term", "terms")}
          className="rounded-lg border border-line bg-white p-5"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What To Avoid</h3>
          <textarea
            name="value"
            required
            rows={4}
            placeholder="Example: behavioral health workforce, clinical staffing, generic arts grants"
            className="mt-3 w-full rounded-md border border-line bg-field px-3 py-3 text-sm outline-none focus:border-accent"
          />
          <input
            name="reason"
            placeholder="Optional reason"
            className="mt-3 w-full rounded-md border border-line bg-field px-3 py-3 text-sm outline-none focus:border-accent"
          />
          <button className="mt-3 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-accent">
            Save Exclusions
          </button>
        </form>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-white p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Opportunity Lanes</h3>
          <div className="mt-3 grid gap-2">
            {(profile.opportunity_lanes ?? []).map((lane) => (
              <div key={lane} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-field px-3 py-2">
                <span className="text-sm font-medium text-ink">{lane}</span>
                <button
                  type="button"
                  onClick={() =>
                    submitFeedback({
                      feedbackKind: "exclude_lane",
                      value: lane,
                      lanes: [lane],
                      reason: "User removed this lane from the profile."
                    })
                  }
                  className="rounded-md border border-line bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-accent"
                >
                  Exclude
                </button>
              </div>
            ))}
          </div>
        </div>

        <form
          onSubmit={(event) => onSimpleSubmit(event, "change_target_geography", "targetGeographies")}
          className="rounded-lg border border-line bg-white p-5"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Target Geography</h3>
          <textarea
            name="value"
            rows={4}
            required
            placeholder="Example: California, Los Angeles County, national school districts"
            className="mt-3 w-full rounded-md border border-line bg-field px-3 py-3 text-sm outline-none focus:border-accent"
          />
          <button className="mt-3 rounded-md border border-line bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-accent">
            Save Geography
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-line bg-white p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Current Connector Search Strategy</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold text-ink">Search terms</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {strategy.search_terms.slice(0, 36).map((term) => (
                <span key={term} className={pillClass("blue")}>{term}</span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Exclude terms</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {strategy.exclude_terms.slice(0, 28).map((term) => (
                <span key={term} className={pillClass("amber")}>{term}</span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
