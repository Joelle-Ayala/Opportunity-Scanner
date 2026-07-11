"use client";

import { useFormStatus } from "react-dom";
import { trackProductEvent } from "@/lib/productAnalytics";

export function ScanSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      onClick={(event) => {
        const form = event.currentTarget.form;
        if (!form?.checkValidity()) return;
        trackProductEvent("scan_started", { entry_point: "homepage" });
        trackProductEvent("email_captured", { surface: "scan", marketing_consent: false });
      }}
      className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] disabled:cursor-wait disabled:bg-slate-400"
    >
      {pending ? "Building your scan..." : "Build Free Pipeline Preview"}
    </button>
  );
}
