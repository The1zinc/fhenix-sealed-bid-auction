import type { Config } from "tailwindcss";

const config: Config = {
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
      },
      boxShadow: {
        glow: "0 0 80px rgba(143, 125, 255, 0.28)",
      },
    },
  },
  plugins: [],
};

export default config;
