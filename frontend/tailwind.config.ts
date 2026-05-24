import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0b1020",
        frost: "#dff7ff",
        violetGlow: "#8f7dff",
        // Custom brand palette
        brand: {
          50: "#edfcff",
          100: "#d6f6ff",
          200: "#b5efff",
          300: "#83e5ff",
          400: "#48d2ff",
          500: "#1eb3ff",
          600: "#0694ff",
          700: "#0080ff",
          800: "#0863c5",
          900: "#0d569b",
          950: "#0e345d",
        },
        surface: {
          0: "var(--surface-0)",
          50: "var(--surface-50)",
          100: "var(--surface-100)",
          200: "var(--surface-200)",
          300: "var(--surface-300)",
          400: "var(--surface-400)",
          500: "var(--surface-500)",
          600: "var(--surface-600)",
          700: "var(--surface-700)",
          800: "var(--surface-800)",
          900: "var(--surface-900)",
          950: "var(--surface-950)",
        },
      },
      boxShadow: {
        glow: "0 0 80px rgba(143, 125, 255, 0.28)",
        "glow-sm": "0 0 30px rgba(143, 125, 255, 0.15)",
        "glow-cyan": "0 0 60px rgba(34, 211, 238, 0.15)",
        "card": "0 1px 3px rgba(0,0,0,0.06), 0 4px 20px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 30px rgba(0,0,0,0.08), 0 0 50px rgba(143, 125, 255, 0.08)",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s linear infinite",
        "float": "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-mesh": "linear-gradient(135deg, var(--mesh-1) 0%, var(--mesh-2) 44%, var(--mesh-3) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
