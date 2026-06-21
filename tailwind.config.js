/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#FF7A00',
          light: '#FFB066',
          dark: '#E06A00',
          soft: '#FFF4E8',
        },
        gray: {
          950: '#0D0D0F',
          900: '#1E1E1E',
          800: '#2C2C2C',
          600: '#4A4A4A',
          500: '#6B7280',
          300: '#D1D5DB',
          200: '#E5E7EB',
          100: '#F3F4F6',
          50:  '#F9FAFB',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 2px 12px 0 rgba(0,0,0,0.06)',
        'card-hover': '0 6px 24px 0 rgba(0,0,0,0.10)',
        primary: '0 6px 20px 0 rgba(255,122,0,0.30)',
      },
    },
  },
  plugins: [],
};
