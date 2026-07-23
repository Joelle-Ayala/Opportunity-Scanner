import type { ReactNode } from "react";

type GrowthPlanPromptProps = {
  context: "capacity" | "daily" | "report";
  companyName?: string;
  compact?: boolean;
  action: ReactNode;
};

const content = {
  capacity: {
    eyebrow: "Monitor plan limit reached",
    title: "Track more companies with Growth",
    description:
      "Growth expands your workspace to three monitored company profiles and checks each one daily."
  },
  daily: {
    eyebrow: "Need a faster signal cycle?",
    title: "Move from weekly to daily monitoring",
    description:
      "Growth checks up to three company profiles every day and includes contact-enrichment credits for active pursuits."
  },
  report: {
    eyebrow: "Build a broader opportunity pipeline",
    title: "Monitor this report and up to two more companies daily",
    description:
      "Growth adds daily scans, three monitored company profiles, contact enrichment, and CRM-ready workflows."
  }
} as const;

export function GrowthPlanPrompt({
  context,
  companyName,
  compact = false,
  action
}: GrowthPlanPromptProps) {
  const copy = content[context];
  const description = companyName && context === "report"
    ? `Keep ${companyName} current with daily scans, then add up to two more company profiles with contact enrichment and CRM-ready workflows.`
    : copy.description;

  return (
    <section
      aria-label="Growth plan recommendation"
      className={`border border-cyan-200 bg-cyan-50 ${compact ? "rounded-md px-4 py-3" : "rounded-lg px-5 py-5"}`}
    >
      <div className={`flex flex-wrap justify-between gap-4 ${compact ? "items-center" : "items-start"}`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase text-accent">{copy.eyebrow}</p>
          <h2 className={`${compact ? "mt-1 text-base" : "mt-2 text-lg"} font-semibold text-ink`}>
            {copy.title}
          </h2>
          <p className={`${compact ? "mt-1" : "mt-2"} max-w-3xl text-sm leading-6 text-slate-700`}>
            {description}
          </p>
        </div>
        <div className="shrink-0">{action}</div>
      </div>
    </section>
  );
}
