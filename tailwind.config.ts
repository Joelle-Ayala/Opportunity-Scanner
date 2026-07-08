import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#14213D",
        field: "#F6F7F9",
        line: "#D9DEE7",
        accent: "#0E7C86",
        signal: "#2E9D70",
        review: "#C7861D",
        muted: "#667085",
        ember: "#D95D39",
        steel: "#42526E",
        mist: "#E9F4F3",
        cream: "#FBFAF7"
      },
      boxShadow: {
        panel: "0 18px 48px rgba(20, 33, 61, 0.09)",
        lift: "0 10px 28px rgba(20, 33, 61, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
