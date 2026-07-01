import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0F172A",
        field: "#F8FAFC",
        line: "#E2E8F0",
        accent: "#2563EB",
        signal: "#10B981",
        review: "#F59E0B",
        muted: "#64748B"
      }
    }
  },
  plugins: []
};

export default config;
