export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#08060e',
          900: '#100c1c',
          850: '#161124',
          800: '#1f1833',
          750: '#2b2245',
          700: '#392d5c',
          600: '#564587',
          500: '#7862b5',
          400: '#9c88d4',
        },
        amethyst: {
          light: '#d8b4fe',
          DEFAULT: 'var(--accent, #a855f7)',
          neon: 'var(--accent, #a855f7)',
          deep: '#7e22ce',
          dark: '#581c87',
        },
        spectral: {
          cyan: '#38bdf8',
          ice: '#bae6fd',
          deep: '#1e3a5f',
          mint: '#10b981',
          rose: '#f43f5e',
          amber: '#f59e0b',
        },
        ghost: {
          50: 'var(--text-primary, #f8fafc)',
          100: 'var(--text-primary, #f1f5f9)',
          200: 'var(--text-secondary, #e2e8f0)',
          300: 'var(--text-secondary, #cbd5e1)',
          400: 'var(--text-muted, #94a3b8)',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          750: '#283346',
          800: '#1e293b',
          850: '#141d2e',
          900: '#0c1322',
          950: 'var(--bg-void, #08060e)',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      borderRadius: {
        panel: '20px',
        card: '16px',
        control: '12px',
      },
      transitionTimingFunction: {
        'ease-out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'spring-island': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
};
