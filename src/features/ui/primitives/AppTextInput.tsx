import { TextInput, type TextInputProps } from '@mantine/core';

type AppTextInputPrimitiveProps = TextInputProps;

export function AppTextInput({ className, ...props }: AppTextInputPrimitiveProps) {
  return <TextInput className={['ui-app-text-input', className].filter(Boolean).join(' ')} {...props} />;
}
