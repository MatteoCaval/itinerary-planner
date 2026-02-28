import { Modal, type ModalProps } from '@mantine/core';

type AppModalPrimitiveProps = ModalProps;

export function AppModal({ className, ...props }: AppModalPrimitiveProps) {
  return <Modal className={['ui-app-modal', className].filter(Boolean).join(' ')} {...props} />;
}
