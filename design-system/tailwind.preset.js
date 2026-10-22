// Grand Emily Design System — Tailwind preset
// Dùng: module.exports = { presets: [require('./design-system/tailwind.preset.js')], ... }
module.exports = {
  theme: {
    extend: {
      colors: {
        pearl: { 700: '#3D352D', 800: '#2E2822', 900: '#1F1B16' },
        brandy: { 100: '#F1E4D8', 400: '#B98A68', 600: '#8A5A3B', 700: '#6E4529' },
        gold: { 200: '#EADBC0', 500: '#C9A46A' },
        reed: { 100: '#E6EADB', 700: '#55633F' },
        lake: { 100: '#DDE7EC', 600: '#3E6577' },
        cream: { 50: '#FBF8F3', 100: '#F7F2EA' },
        stone: { 200: '#EAE2D6', 300: '#DCD2C4', 500: '#8C8275', 700: '#5E554A' },
        success: { DEFAULT: '#3F7350', bg: '#E2EEE5' },
        warning: { DEFAULT: '#9A6418', bg: '#F6EAD3' },
        danger: { DEFAULT: '#A8402F', bg: '#F5E0DB' },
        info: { DEFAULT: '#3E6577', bg: '#DDE7EC' },
        primary: { DEFAULT: '#8A5A3B', hover: '#6E4529', soft: '#F1E4D8' },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', '"Times New Roman"', 'serif'],
        sans: ['"Be Vietnam Pro"', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '5xl': ['3.5rem', { lineHeight: '1.1' }],
        '6xl': ['4.5rem', { lineHeight: '1.05' }],
      },
      letterSpacing: { widest: '0.2em' },
      borderRadius: { sm: '2px', DEFAULT: '4px', md: '4px', lg: '8px', xl: '16px' },
      boxShadow: {
        sm: '0 1px 2px rgba(31,27,22,0.06)',
        md: '0 4px 16px rgba(31,27,22,0.08)',
        lg: '0 16px 40px rgba(31,27,22,0.12)',
        focus: '0 0 0 3px rgba(201,164,106,0.45)',
      },
      maxWidth: { container: '1200px' },
    },
  },
};
