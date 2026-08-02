import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        // Fintech dark palette
        bg: {
          DEFAULT: '#0D0D14',
          surface: '#111118',
          elevated: '#16161F',
          overlay: '#1C1C27',
        },
        border: {
          DEFAULT: 'rgba(255, 255, 255, 0.07)',
          strong: 'rgba(255, 255, 255, 0.12)',
        },
        text: {
          primary: '#F0F0F8',
          secondary: '#9898A8',
          // WCAG AA requires >=4.5:1 for normal text. The previous #555568 measured
          // 2.66:1 on bg and 2.47:1 on bg-elevated -- a hard fail, not a style choice.
          // This value measures 5.17:1 / 4.80:1 on those same two surfaces.
          muted: '#82829A',
        },
        accent: {
          violet: '#7C3AED',
          'violet-light': '#A78BFA',
          blue: '#3B82F6',
          'blue-light': '#93C5FD',
        },
        success: {
          DEFAULT: '#10B981',
          muted: 'rgba(16, 185, 129, 0.15)',
        },
        danger: {
          DEFAULT: '#EF4444',
          muted: 'rgba(239, 68, 68, 0.15)',
        },
        warning: {
          DEFAULT: '#F59E0B',
          muted: 'rgba(245, 158, 11, 0.15)',
        },
        info: {
          DEFAULT: '#3B82F6',
          muted: 'rgba(59, 130, 246, 0.15)',
        },
        // Scoped light palette -- Dashboard route + nav chrome only, see
        // frontend/components/layout/*Light.tsx. Every other page keeps
        // using the dark tokens above; do not reuse these elsewhere yet.
        paper: {
          DEFAULT: '#F9F9F7',
          card: '#FFFFFF',
          subtle: '#F3F3F1',
        },
        ink: {
          primary: '#0B0B0B',
          secondary: '#52514E',
          muted: '#898781',
        },
        line: {
          DEFAULT: 'rgba(11, 11, 11, 0.08)',
          strong: 'rgba(11, 11, 11, 0.14)',
        },
        mono: {
          DEFAULT: '#0B0B0B',
          hover: '#262626',
          muted: 'rgba(11, 11, 11, 0.06)',
        },
        updown: {
          up: '#006300',
          'up-muted': 'rgba(0, 99, 0, 0.10)',
          down: '#D03B3B',
          'down-muted': 'rgba(208, 59, 59, 0.10)',
        },
        gauge: {
          excellent: '#0CA30C',
          good: '#0CA30C',
          fair: '#FAB219',
          poor: '#EC835A',
          critical: '#D03B3B',
        },
        // shadcn/ui CSS variable bridge
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 100%)',
        'gradient-success': 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        'gradient-danger': 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
        'gradient-warning': 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
        'gradient-card': 'linear-gradient(135deg, rgba(124,58,237,0.08) 0%, rgba(59,130,246,0.04) 100%)',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
      },
      boxShadow: {
        glow: '0 0 20px rgba(124, 58, 237, 0.3)',
        'glow-sm': '0 0 10px rgba(124, 58, 237, 0.2)',
        card: '0 4px 24px rgba(0, 0, 0, 0.4)',
        'card-hover': '0 8px 40px rgba(0, 0, 0, 0.6)',
        // Redesign elevation scale (see design dossier): level 1 (grouped rows)
        // uses a background tint only, no shadow -- these two cover level 2
        // (raised, standalone modules) and level 3 (floating, modals/sheets).
        raised: '0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.35)',
        floating: '0 4px 16px rgba(0, 0, 0, 0.4), 0 24px 56px rgba(0, 0, 0, 0.5)',
        // Scoped light palette shadows -- see the `paper`/`ink`/`mono` tokens above.
        soft: '0 1px 2px rgba(11, 11, 11, 0.04), 0 4px 16px rgba(11, 11, 11, 0.06)',
        'soft-hover': '0 2px 6px rgba(11, 11, 11, 0.06), 0 16px 32px rgba(11, 11, 11, 0.10)',
      },
      transitionDuration: {
        micro: '120ms',
        standard: '220ms',
        entrance: '420ms',
        hero: '700ms',
      },
      transitionTimingFunction: {
        standard: 'cubic-bezier(.2, .8, .2, 1)',
        'out-expo': 'cubic-bezier(.16, 1, .3, 1)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-right': { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        shimmer: { from: { backgroundPosition: '-200% 0' }, to: { backgroundPosition: '200% 0' } },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        shimmer: 'shimmer 2s infinite linear',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
