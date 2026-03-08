import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "brand-blue": "#0099FF",
        "brand-yellow": "#FFD500",
        dark: "#070708",
        dark2: "#131316",
        dark3: "#1A1A1F",
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        heading: ["var(--font-heading)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0) rotate(0deg)" },
          "33%": { transform: "translateY(-12px) rotate(0.5deg)" },
          "66%": { transform: "translateY(-6px) rotate(-0.5deg)" },
        },
        orbit: {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        scan: {
          "0%": { top: "-2px", opacity: "0" },
          "10%": { opacity: "0.45" },
          "90%": { opacity: "0.45" },
          "100%": { top: "100%", opacity: "0" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.7" },
          "50%": { transform: "scale(1.1)", opacity: "1" },
        },
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.82)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        orbit: "orbit 20s linear infinite",
        scan: "scan 6s linear infinite",
        marquee: "marquee 30s linear infinite",
        breathe: "breathe 4s ease-in-out infinite",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

