import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './pages/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#5E60CE',
        secondary: '#00BFA6',
        'neutral-dark': '#1E1E2F',
        'neutral-light': '#F5F5F7',
        accent: '#FFD166',
      },
      backgroundImage: {
        'space-gradient':
          'radial-gradient(1000px 500px at 50% -100px, rgba(94,96,206,0.25), transparent), radial-gradient(800px 400px at 100% 0%, rgba(0,191,166,0.20), transparent), radial-gradient(600px 300px at 0% 0%, rgba(30,30,47,0.8), transparent)'
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      keyframes: {
        twinkle: {
          '0%, 100%': { opacity: 0.6 },
          '50%': { opacity: 1 }
        }
      },
      animation: {
        twinkle: 'twinkle 3s ease-in-out infinite'
      }
    }
  },
  plugins: []
};

export default config;
