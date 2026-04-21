import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      animation: {
        'pulse-glow': 'pulseGlow 1.5s ease-in-out infinite',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(139,92,246,0.4)' },
          '50%':       { boxShadow: '0 0 30px rgba(139,92,246,0.9)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
