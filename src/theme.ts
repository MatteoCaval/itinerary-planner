import { createTheme } from '@mantine/core';

export const theme = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  focusRing: 'auto',
  fontFamily: 'Manrope, Inter, sans-serif',
  headings: {
    fontFamily: '"Space Grotesk", Manrope, sans-serif',
    fontWeight: '700',
  },
  components: {
    Button: {
      defaultProps: {
        size: 'sm',
        radius: 'md',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
});
