"use client";

import { useFormStatus } from "react-dom";

export function ScanSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      disabled={pending}
      className="rounded-md bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#0A6871] disabled:cursor-wait disabled:bg-slate-400"
    >
      {pending ? "Building your scan..." : "Build Free Pipeline Preview"}
    </button>
  );
}
