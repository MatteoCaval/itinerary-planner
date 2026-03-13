import { Button, type ButtonProps } from '@mantine/core';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type AppButtonProps = ButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonProps>;

export const AppButton = forwardRef<HTMLButtonElement, AppButtonProps>(
  ({ className, ...props }, ref) => (
    <Button ref={ref} className={['ui-app-button', className].filter(Boolean).join(' ')} {...props} />
  ),
);

AppButton.displayName = 'AppButton';
