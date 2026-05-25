/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          nav: '#111111',
          primary: '#29B5CC',
          'primary-dark': '#1E8899',
          'primary-light': '#E1F5FA',
          bg: '#F7F8F9',
          border: '#CDE9EF',
          'note-bg': '#E9F6FA',
          'note-border': '#BEE8F0',
          'note-text': '#1E8899',
        },
        dark: {
          bg:          '#0a0a0a',
          surface:     '#111111',
          elevated:    '#1a1a1a',
          border:      'rgba(255,255,255,0.06)',
          text:        '#f0f0f0',
          muted:       '#888888',
          subtle:      '#555555',
          accent:      '#29B5CC',
          'accent-bg': 'rgba(41,181,204,0.10)',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
