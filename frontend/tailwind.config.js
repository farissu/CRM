/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        saas: {
          // Full accent scale — pulled from the brand's muted blue-gray tokens.
          50: '#eef6ff',
          100: '#eef6ff',
          200: '#d6ebff',
          300: '#b5d9fd',
          400: '#94bce3',
          500: '#749dc4',
          600: '#597ea3',
          700: '#416180',
          800: '#33506b',
          900: '#1f3346',
          // Semantic aliases so existing components (saas-primary-blue, saas-bg, ...)
          // keep working — only the underlying values changed.
          'primary-blue': '#597ea3',
          'secondary-blue': '#749dc4',
          'accent-blue': '#94bce3',
          'sidebar-blue': '#1f3346',
          'bg': '#F7F9FC',
          'chat-user': '#eaf2fb',
          'chat-agent': '#FFFFFF',
          'text-primary': '#1a2733',
          'border': '#E1E8F0',
        },
        whatsapp: {
          green: '#25D366',
          'green-dark': '#128C7E',
          teal: '#075E54',
          'light-bg': '#ECE5DD',
          'bubble-out': '#DCF8C6',
          'bubble-in': '#FFFFFF',
        },
      },
      boxShadow: {
        'soft': '0 8px 24px rgba(31, 51, 70, 0.08)',
        'soft-sm': '0 2px 8px rgba(31, 51, 70, 0.06)',
        'soft-lg': '0 16px 40px rgba(31, 51, 70, 0.14)',
      },
    },
  },
  plugins: [],
}
