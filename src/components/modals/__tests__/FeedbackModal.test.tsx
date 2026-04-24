import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FeedbackModal from '../FeedbackModal';

vi.mock('@/firebase', () => ({
  submitFeedback: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { submitFeedback } from '@/firebase';
import { toast } from 'sonner';

describe('FeedbackModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the textarea with a disabled Send button when empty', () => {
    render(<FeedbackModal onClose={() => {}} />);
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeDisabled();
    expect(screen.getByLabelText(/feedback/i)).toBeInTheDocument();
  });

  it('enables Send once the user types non-whitespace text', () => {
    render(<FeedbackModal onClose={() => {}} />);
    const textarea = screen.getByLabelText(/feedback/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Love this app!' } });
    const sendBtn = screen.getByRole('button', { name: /send/i });
    expect(sendBtn).toBeEnabled();
  });

  it('keeps Send disabled for whitespace-only input', () => {
    render(<FeedbackModal onClose={() => {}} />);
    const textarea = screen.getByLabelText(/feedback/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '     ' } });
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('updates the char counter as the user types', () => {
    render(<FeedbackModal onClose={() => {}} />);
    const textarea = screen.getByLabelText(/feedback/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'hello' } });
    expect(screen.getByText('5/2000')).toBeInTheDocument();
  });

  it('enforces a 2000 character maxLength on the textarea', () => {
    render(<FeedbackModal onClose={() => {}} />);
    const textarea = screen.getByLabelText(/feedback/i) as HTMLTextAreaElement;
    expect(textarea.maxLength).toBe(2000);
  });

  it('calls onClose, shows success toast, and clears text on successful submit', async () => {
    vi.mocked(submitFeedback).mockResolvedValueOnce({ success: true });
    const onClose = vi.fn();
    render(<FeedbackModal onClose={onClose} />);
    const textarea = screen.getByLabelText(/feedback/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'great app' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(submitFeedback).toHaveBeenCalledWith('great app'));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(toast.success).toHaveBeenCalledWith('Thanks — feedback sent.');
  });

  it('shows inline error and keeps modal open on failure', async () => {
    vi.mocked(submitFeedback).mockResolvedValueOnce({
      success: false,
      error: 'network down',
    });
    const onClose = vi.fn();
    render(<FeedbackModal onClose={onClose} />);
    const textarea = screen.getByLabelText(/feedback/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'great app' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));
    await waitFor(() => expect(submitFeedback).toHaveBeenCalled());
    expect(await screen.findByRole('alert')).toHaveTextContent(/network down/i);
    expect(onClose).not.toHaveBeenCalled();
    expect(textarea.value).toBe('great app');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
