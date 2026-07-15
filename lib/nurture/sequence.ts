export type NurtureTouch = {
  number: 1 | 2 | 3 | 4 | 5;
  dayOffset: 1 | 2 | 4 | 7 | 10;
  subject: (companyName?: string | null) => string;
  heading: string;
  body: string[];
  ctaLabel: string;
  destination: "report" | "pricing";
};

function companyLabel(companyName?: string | null): string {
  return companyName?.trim() || "your company";
}

export const SCAN_NURTURE_TOUCHES: readonly NurtureTouch[] = [
  {
    number: 1,
    dayOffset: 1,
    subject: (companyName) => `Three ways to use ${companyLabel(companyName)}'s opportunity report`,
    heading: "Put your opportunity report to work",
    body: [
      "Start by comparing the highest-actionability signals, opening their source records, and choosing the one with the strongest timing and fit.",
      "Then use its revenue motion to choose a pursuit path, follow the recommended contact route, and assign the next action to an owner."
    ],
    ctaLabel: "Choose your first action",
    destination: "report"
  },
  {
    number: 2,
    dayOffset: 2,
    subject: () => "Choose one public-sector opportunity to move forward",
    heading: "Turn one signal into a next step",
    body: [
      "A useful report should change what happens next. Pick one high-actionability signal and assign its next best action.",
      "That may be a direct application, an agency sale, a funded-buyer conversation, a partner route, or a deliberate monitoring task."
    ],
    ctaLabel: "Open the action table",
    destination: "report"
  },
  {
    number: 3,
    dayOffset: 4,
    subject: () => "The right contact path is not always an email address",
    heading: "Follow the contact path that fits the opportunity",
    body: [
      "The fastest route may be a procurement office, program team, vendor registration page, award recipient, channel partner, or source-native contact.",
      "Use the report's contact strategy to reach the role that can move the opportunity, then capture the result in your workflow."
    ],
    ctaLabel: "Review contact paths",
    destination: "report"
  },
  {
    number: 4,
    dayOffset: 7,
    subject: () => "Public-sector opportunities change after the first scan",
    heading: "Keep the strongest signals current",
    body: [
      "Deadlines move, awards identify new funded buyers, and early notices become active solicitations.",
      "Ongoing monitoring helps you catch those changes without repeating the full research process by hand."
    ],
    ctaLabel: "Compare monitoring plans",
    destination: "pricing"
  },
  {
    number: 5,
    dayOffset: 10,
    subject: () => "Get 12 months of monitoring for the price of 10",
    heading: "Put opportunity monitoring on a durable cadence",
    body: [
      "Annual Monitor is $990 and annual Growth is $2,490. Each is billed once per year at the cost of 10 monthly payments.",
      "That gives you 12 months of access for the price of 10, or 2 months free annually."
    ],
    ctaLabel: "View annual plans",
    destination: "pricing"
  }
] as const;

export function getNurtureTouch(touchNumber: number): NurtureTouch {
  const touch = SCAN_NURTURE_TOUCHES.find((candidate) => candidate.number === touchNumber);
  if (!touch) throw new Error("Unknown nurture touch.");
  return touch;
}

export function nurtureScheduledAt(touchNumber: number, enrolledAt: Date): Date {
  const touch = getNurtureTouch(touchNumber);
  return new Date(enrolledAt.getTime() + touch.dayOffset * 24 * 60 * 60 * 1000);
}
