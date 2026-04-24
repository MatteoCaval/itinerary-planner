import { useState } from 'react';
import { toast } from 'sonner';
import ModalBase from '@/components/ui/ModalBase';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { submitFeedback } from '@/firebase';

interface FeedbackModalProps {
  onClose: () => void;
}

const MAX_LEN = 2000;

function FeedbackModal({ onClose }: FeedbackModalProps) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = text.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const result = await submitFeedback(text);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? 'Could not send feedback. Please try again.');
      return;
    }
    toast.success('Thanks — feedback sent.');
    setText('');
    onClose();
  };

  const footer = {
    cancel: (
      <Button variant="outline" size="sm" onClick={onClose}>
        Cancel
      </Button>
    ),
    primary: (
      <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
        {submitting ? 'Sending…' : 'Send'}
      </Button>
    ),
  };

  return (
    <ModalBase
      title="Share your thoughts"
      description="Got an idea, a bug, or general thoughts? Drop it below — we read everything."
      onClose={onClose}
      footer={footer}
    >
      <div className="space-y-3">
        <label htmlFor="feedback-text" className="sr-only">
          Feedback
        </label>
        <Textarea
          id="feedback-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          maxLength={MAX_LEN}
          placeholder="What's on your mind?"
        />
        <div className="flex justify-end">
          <span className="text-xs text-muted-foreground font-num">
            {text.length}/{MAX_LEN}
          </span>
        </div>
        {error && <ErrorMessage>{error}</ErrorMessage>}
      </div>
    </ModalBase>
  );
}

export default FeedbackModal;
