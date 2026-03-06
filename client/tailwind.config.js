/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        prompt: ['Prompt', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: '#2e7d32',
          50: '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#4caf50',
          600: '#43a047',
          700: '#388e3c',
          800: '#2e7d32',
          900: '#1b5e20',
        },
        accent: {
          DEFAULT: '#2196F3',
          50: '#e3f2fd',
          100: '#bbdefb',
          200: '#90caf9',
          300: '#64b5f6',
          400: '#42a5f5',
          500: '#2196f3',
          600: '#1e88e5',
          700: '#1976d2',
          800: '#1565c0',
          900: '#0d47a1',
        },
        danger: {
          DEFAULT: '#f44336',
          50: '#ffebee',
          100: '#ffcdd2',
          200: '#ef9a9a',
          300: '#e57373',
          400: '#ef5350',
          500: '#f44336',
          600: '#e53935',
          700: '#d32f2f',
          800: '#c62828',
          900: '#b71c1c',
        },
        success: '#4caf50',
        warning: '#ff9800',
        info: '#2196f3',
        soil: {
          DEFAULT: '#2e7d32',
          50:  '#e8f5e9',
          100: '#c8e6c9',
          200: '#a5d6a7',
          300: '#81c784',
          400: '#66bb6a',
          500: '#4caf50',
          600: '#43a047',
          700: '#388e3c',
          800: '#2e7d32',
          900: '#1b5e20',
        },
        soilMetric: {
          moisture: '#4facfe',
          temp: '#ff6b6b',
          ec: '#feca57',
          ph: '#a29bfe',
          nitrogen: '#00d2d3',
          phosphorus: '#ff9ff3',
          potassium: '#54a0ff',
        },
        air: {
          temp: '#ff6b6b',
          humidity: '#48dbfb',
          co2: '#feca57',
          light: '#f9ca24',
        },
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'elevated': '0 10px 40px -10px rgba(0, 0, 0, 0.15)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-soft': 'pulse 2.2s ease-in-out infinite',
        'spin-slow': 'spin 2s linear infinite',         // พัดลม หมุน
        'shimmer': 'shimmer 2s infinite',
        // ✅ ใหม่
        'bounce-slow': 'bounce-slow 1.4s ease-in-out infinite',  // น้ำโซน หยดน้ำ
        'flicker': 'flicker 1.8s ease-in-out infinite',          // แสงเสริม กะพริบ
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        // ✅ น้ำโซน: หยดน้ำกระเด้งช้าๆ
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0) scaleY(1)', animationTimingFunction: 'cubic-bezier(0.8,0,1,1)' },
          '50%': { transform: 'translateY(-20%) scaleY(0.9)', animationTimingFunction: 'cubic-bezier(0,0,0.2,1)' },
        },
        // ✅ แสงเสริม: กะพริบเหมือนไฟ
        'flicker': {
          '0%, 100%': { opacity: '1',    transform: 'scale(1)' },
          '20%':       { opacity: '0.85', transform: 'scale(1.05)' },
          '40%':       { opacity: '1',    transform: 'scale(1)' },
          '60%':       { opacity: '0.75', transform: 'scale(0.97)' },
          '80%':       { opacity: '1',    transform: 'scale(1.03)' },
        },
      },
    },
  },
  plugins: [],
}