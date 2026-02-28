import { Group, Stack, Text } from '@mantine/core';
import type { ChangeEvent } from 'react';
import { AppButton } from '../ui/primitives/AppButton';
import { AppModal } from '../ui/primitives/AppModal';
import { AppTextInput } from '../ui/primitives/AppTextInput';

interface TripActionDialogsProps {
  createOpened: boolean;
  renameOpened: boolean;
  deleteOpened: boolean;
  signOutOpened: boolean;
  activeTripName: string;
  nameDraft: string;
  onNameDraftChange: (value: string) => void;
  onCloseCreate: () => void;
  onCloseRename: () => void;
  onCloseDelete: () => void;
  onCloseSignOut: () => void;
  onConfirmCreate: () => void;
  onConfirmRename: () => void;
  onConfirmDelete: () => void;
  onConfirmSignOut: () => void;
}

export function TripActionDialogs({
  createOpened,
  renameOpened,
  deleteOpened,
  signOutOpened,
  activeTripName,
  nameDraft,
  onNameDraftChange,
  onCloseCreate,
  onCloseRename,
  onCloseDelete,
  onCloseSignOut,
  onConfirmCreate,
  onConfirmRename,
  onConfirmDelete,
  onConfirmSignOut,
}: TripActionDialogsProps) {
  const nameTrimmed = nameDraft.trim();

  return (
    <>
      <AppModal
        opened={createOpened}
        onClose={onCloseCreate}
        title="Create Trip"
        centered
        size="sm"
        className="trip-action-modal"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirmCreate();
          }}
        >
          <Stack gap="sm">
            <AppTextInput
              label="Trip name"
              placeholder="Summer in Japan"
              value={nameDraft}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onNameDraftChange(event.currentTarget.value)}
              autoFocus
            />
            <Group justify="flex-end" gap="xs">
              <AppButton variant="default" onClick={onCloseCreate}>Cancel</AppButton>
              <AppButton type="submit">Create</AppButton>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        opened={renameOpened}
        onClose={onCloseRename}
        title="Rename Trip"
        centered
        size="sm"
        className="trip-action-modal"
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onConfirmRename();
          }}
        >
          <Stack gap="sm">
            <AppTextInput
              label="Trip name"
              value={nameDraft}
              onChange={(event: ChangeEvent<HTMLInputElement>) => onNameDraftChange(event.currentTarget.value)}
              autoFocus
            />
            <Group justify="flex-end" gap="xs">
              <AppButton variant="default" onClick={onCloseRename}>Cancel</AppButton>
              <AppButton type="submit" disabled={!nameTrimmed}>Save</AppButton>
            </Group>
          </Stack>
        </form>
      </AppModal>

      <AppModal
        opened={deleteOpened}
        onClose={onCloseDelete}
        title="Delete Trip"
        centered
        size="sm"
        className="trip-action-modal"
      >
        <Stack gap="sm">
          <Text size="sm">
            Delete <Text span fw={700}>{activeTripName}</Text>? This action cannot be undone.
          </Text>
          <Group justify="flex-end" gap="xs">
            <AppButton variant="default" onClick={onCloseDelete}>Cancel</AppButton>
            <AppButton color="red" onClick={onConfirmDelete}>Delete</AppButton>
          </Group>
        </Stack>
      </AppModal>

      <AppModal
        opened={signOutOpened}
        onClose={onCloseSignOut}
        title="Sign Out"
        centered
        size="sm"
        className="trip-action-modal"
      >
        <Stack gap="sm">
          <Text size="sm">Sign out from this account? Your local guest data remains on this device.</Text>
          <Group justify="flex-end" gap="xs">
            <AppButton variant="default" onClick={onCloseSignOut}>Cancel</AppButton>
            <AppButton color="blue" onClick={onConfirmSignOut}>Sign out</AppButton>
          </Group>
        </Stack>
      </AppModal>
    </>
  );
}
