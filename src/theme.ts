import { createTheme, rem } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'brand',
  colors: {
    // Custom blue/indigo blend for a modern tech feel
    brand: [
      '#eff6ff', // 0
      '#dbeafe', // 1
      '#bfdbfe', // 2
      '#93c5fd', // 3
      '#60a5fa', // 4
      '#3b82f6', // 5
      '#2563eb', // 6
      '#1d4ed8', // 7
      '#1e40af', // 8
      '#1e3a8a', // 9
    ],
    // A slate-like neutral palette
    neutral: [
      '#f8fafc', // 0
      '#f1f5f9', // 1
      '#e2e8f0', // 2
      '#cbd5e1', // 3
      '#94a3b8', // 4
      '#64748b', // 5
      '#475569', // 6
      '#334155', // 7
      '#1e293b', // 8
      '#0f172a', // 9
    ],
  },
  defaultRadius: 'md',
  focusRing: 'auto',
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  headings: {
    fontFamily: '"Outfit", "Space Grotesk", Inter, sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: rem(36), lineHeight: '1.2' },
      h2: { fontSize: rem(30), lineHeight: '1.25' },
      h3: { fontSize: rem(24), lineHeight: '1.3' },
      h4: { fontSize: rem(20), lineHeight: '1.35' },
      h5: { fontSize: rem(16), lineHeight: '1.4' },
      h6: { fontSize: rem(14), lineHeight: '1.45' },
    },
  },
  shadows: {
    xs: '0 1px 2px rgba(15, 23, 42, 0.04)',
    sm: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
    md: '0 4px 6px -1px rgba(15, 23, 42, 0.08), 0 2px 4px -2px rgba(15, 23, 42, 0.04)',
    lg: '0 10px 15px -3px rgba(15, 23, 42, 0.08), 0 4px 6px -4px rgba(15, 23, 42, 0.04)',
    xl: '0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'md',
        size: 'sm',
        fw: 600,
      },
      styles: {
        root: {
          transition: 'transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease',
        },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'lg',
        shadow: 'sm',
      },
      styles: {
        root: {
          border: '1px solid var(--mantine-color-neutral-2)',
        },
      },
    },
    Card: {
      defaultProps: {
        radius: 'lg',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        root: {
          transition: 'transform 0.15s ease, background-color 0.15s ease',
        },
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
      styles: {
        input: {
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
        },
      },
    },
    Tooltip: {
      defaultProps: {
        radius: 'md',
        withArrow: true,
        transitionProps: { transition: 'pop', duration: 150 },
      },
    },
    AppShell: {
      styles: {
        main: {
          backgroundColor: 'var(--mantine-color-neutral-0)',
        },
      },
    },
  },
});
