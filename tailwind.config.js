/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./dashboard/**/*.{html,js}",
    "./dashboard/*.{html,js}"
  ],
  safelist: [
    // Ensure all dynamic gradient avatars and badges are always included
    'from-indigo-500', 'to-purple-600',
    'from-blue-500', 'to-indigo-600',
    'from-emerald-500', 'to-teal-600',
    'from-amber-500', 'to-orange-600',
    'from-rose-500', 'to-pink-600',
    'from-violet-500', 'to-purple-600',
    'from-cyan-500', 'to-blue-600',
    'from-teal-500', 'to-emerald-600',
    'from-fuchsia-500', 'to-pink-600',
    'from-slate-700', 'to-slate-900',
    'bg-indigo-50', 'text-indigo-700',
    'bg-emerald-50', 'text-emerald-800',
    'bg-amber-50', 'text-amber-900',
    'bg-purple-50', 'text-purple-700',
    'bg-sky-50', 'text-sky-700',
    'bg-blue-50', 'text-blue-700',
    'bg-emerald-100', 'text-emerald-800',
    'bg-amber-100', 'text-amber-800',
    'bg-slate-100', 'text-slate-700',
    'line-clamp-2',
    'shadow-2xs', 'shadow-xs'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        }
      }
    },
  },
  plugins: [],
}

