import { FormEvent, useEffect, useState } from 'react';
import { Alert, Button, Group, Modal, PasswordInput, Stack, Tabs, Text, TextInput } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AlertCircle, LogIn, UserPlus } from 'lucide-react';
import { ENABLE_ACCOUNT_AUTH } from '../constants/featureFlags';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  show: boolean;
  onClose: () => void;
}

export function AuthModal({ show, onClose }: AuthModalProps) {
  const { signIn, signInWithGoogle, signUp, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<string | null>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!show) return;
    setError(null);
    setPassword('');
    setConfirmPassword('');
  }, [show, activeTab]);

  const closeAsGuest = () => {
    setError(null);
    onClose();
  };

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const result = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to sign in.');
      return;
    }

    notifications.show({ color: 'green', title: 'Signed in', message: 'Your trips now sync to your account.' });
    onClose();
  };

  const handleSignUp = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    const result = await signUp(email.trim(), password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to create account.');
      return;
    }

    notifications.show({ color: 'green', title: 'Account created', message: 'You are signed in and syncing is enabled.' });
    onClose();
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsSubmitting(true);
    const result = await signInWithGoogle();
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to sign in with Google.');
      return;
    }

    notifications.show({ color: 'green', title: 'Signed in', message: 'Your trips now sync to your account.' });
    onClose();
  };

  const isBusy = authLoading || isSubmitting;

  if (!ENABLE_ACCOUNT_AUTH) {
    return (
      <Modal opened={show} onClose={onClose} title="Account (Coming soon)" centered zIndex={2500}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Login and registration are temporarily disabled while implementation is in progress.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Continue as guest
            </Button>
          </Group>
        </Stack>
      </Modal>
    );
  }

  return (
    <Modal opened={show} onClose={onClose} title="Account (Optional)" centered zIndex={2500}>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Creating an account is optional. You can continue in guest mode at any time.
        </Text>

        <Button variant="default" onClick={handleGoogleSignIn} loading={isBusy}>
          Continue with Google
        </Button>

        <Text size="xs" c="dimmed" ta="center">
          or use email
        </Text>

        {error && (
          <Alert color="red" icon={<AlertCircle size={16} />}>
            {error}
          </Alert>
        )}

        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List grow>
            <Tabs.Tab value="signin" leftSection={<LogIn size={16} />}>
              Sign In
            </Tabs.Tab>
            <Tabs.Tab value="signup" leftSection={<UserPlus size={16} />}>
              Register
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="signin" pt="md">
            <form onSubmit={handleSignIn}>
              <Stack gap="sm">
                <TextInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                />
                <PasswordInput
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  required
                />
                <Button type="submit" loading={isBusy}>
                  Sign In
                </Button>
              </Stack>
            </form>
          </Tabs.Panel>

          <Tabs.Panel value="signup" pt="md">
            <form onSubmit={handleSignUp}>
              <Stack gap="sm">
                <TextInput
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  required
                />
                <PasswordInput
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.currentTarget.value)}
                  description="Minimum 6 characters"
                  required
                />
                <PasswordInput
                  label="Confirm password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                  required
                />
                <Button type="submit" loading={isBusy}>
                  Create account
                </Button>
              </Stack>
            </form>
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end">
          <Button variant="default" onClick={closeAsGuest}>
            Continue as guest
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
