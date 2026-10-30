/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ghost: {
          950: "#08090b",
          900: "#0e1116",
          850: "#141820",
          800: "#1c212b",
          700: "#272e3b",
          600: "#384252",
          500: "#505e73",
          400: "#7b8b9f",
          300: "#a9b7c8",
          200: "#d3dbe3",
          100: "#f0f3f6",
        },
        spectral: {
          cyan: "#38bdf8",
          mint: "#10b981",
          emerald: "#059669",
          amber: "#f59e0b",
          rose: "#f43f5e",
        }
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      animation: {
        "pulse-subtle": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "float": "float 4s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        }
      }
    },
  },
  plugins: [],
}
