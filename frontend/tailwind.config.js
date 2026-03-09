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
          'primary-blue': '#2563EB',
          'secondary-blue': '#3B82F6',
          'accent-blue': '#60A5FA',
          'sidebar-blue': '#1E40AF',
          'bg': '#F8FAFC',
          'chat-user': '#DBEAFE',
          'chat-agent': '#FFFFFF',
          'text-primary': '#0F172A',
          'border': '#E2E8F0',
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
        'soft': '0 8px 24px rgba(0, 0, 0, 0.08)',
        'soft-sm': '0 2px 8px rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
