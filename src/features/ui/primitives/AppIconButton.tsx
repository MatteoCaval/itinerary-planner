import { ActionIcon, type ActionIconProps } from '@mantine/core';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

type AppIconButtonProps = ActionIconProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ActionIconProps>;

export const AppIconButton = forwardRef<HTMLButtonElement, AppIconButtonProps>(
  ({ className, ...props }, ref) => (
    <ActionIcon ref={ref} className={['ui-app-icon-button', className].filter(Boolean).join(' ')} {...props} />
  ),
);

AppIconButton.displayName = 'AppIconButton';
