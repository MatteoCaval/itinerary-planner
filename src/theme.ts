import { createTheme } from '@mantine/core';

export const theme = createTheme({
    primaryColor: 'blue',
    defaultRadius: 'md',
    fontFamily: 'Inter, sans-serif',
    headings: {
        fontFamily: 'Inter, sans-serif',
    },
    components: {
        Button: {
            defaultProps: {
                size: 'sm',
            },
        },
    },
});
