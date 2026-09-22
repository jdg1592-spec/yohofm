/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clan: {
          bg: '#0B0C10',
          surface: '#121212',
          card: '#1A1A1F',
          border: '#2A2A30',
          hover: '#252530',
        },
        gold: {
          50: '#FFF9E6',
          100: '#FFF0BF',
          200: '#FFE599',
          300: '#FFD700',
          400: '#E5A93C',
          500: '#D4AF37',
          600: '#B8941F',
          700: '#8B7014',
          800: '#5E4B0D',
          900: '#312806',
        },
      },
      fontFamily: {
        sans: ['Pretendard', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-in': 'slideIn 0.3s ease-out',
      },
      keyframes: {
        pulseGold: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(212, 175, 55, 0.4)' },
          '50%': { boxShadow: '0 0 20px 4px rgba(212, 175, 55, 0.2)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
