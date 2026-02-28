import { Button, type ButtonProps } from '@mantine/core';
import type { ButtonHTMLAttributes } from 'react';

type AppButtonProps = ButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ButtonProps>;

export function AppButton({ className, ...props }: AppButtonProps) {
  return <Button className={['ui-app-button', className].filter(Boolean).join(' ')} {...props} />;
}
