import { ActionIcon, type ActionIconProps } from '@mantine/core';
import type { ButtonHTMLAttributes } from 'react';

type AppIconButtonProps = ActionIconProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof ActionIconProps>;

export function AppIconButton({ className, ...props }: AppIconButtonProps) {
  return <ActionIcon className={['ui-app-icon-button', className].filter(Boolean).join(' ')} {...props} />;
}
