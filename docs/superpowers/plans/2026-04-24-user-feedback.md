# User Feedback Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an always-anonymous "Send feedback" entry to the ProfileMenu dropdown that writes a free-text message to Firebase Realtime Database at `/feedback/{autoId}`.

**Architecture:** A new `submitFeedback` helper in `src/firebase.ts` (matching the existing `saveItinerary` pattern: dynamic `firebase/database` import, `push` with `{ text, timestamp }`, errors funnelled through `trackError` + `formatErrorMessage`). A new `FeedbackModal` built on `ModalBase` with a `Textarea` + char counter + inline `ErrorMessage`. ProfileMenu grows a new "Help" section with a single `DropdownMenuItem` that toggles a local `showFeedback` state to mount the modal. No changes to `App.tsx`; no identity is ever attached.

**Tech Stack:** React + TypeScript, Vite, Tailwind v4, shadcn/ui (Radix dialog/dropdown), Firebase Realtime Database (modular SDK), sonner (toasts), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-04-24-user-feedback-design.md`.

**Branch:** `feat/user-feedback` (already checked out).

---

## File Structure

| Action | Path | Responsibility |
| --- | --- | --- |
| Create | `src/firebase.test.ts` | Unit tests for the new `submitFeedback` helper. |
| Modify | `src/firebase.ts` | Export `submitFeedback(text)` that pushes `{ text, timestamp }` to `/feedback`. |
| Create | `src/components/modals/FeedbackModal.tsx` | Self-contained modal: textarea, char counter, submit, error surface. |
| Create | `src/components/modals/__tests__/FeedbackModal.test.tsx` | Component tests covering empty/long/success/failure flows. |
| Modify | `src/components/panels/ProfileMenu.tsx` | Add local `showFeedback` state, new "Help" dropdown section, mount the modal. |
| Create | `firebase.feedback.rules.json` (repo root) | Canonical copy of the RTDB rules snippet that must be merged in the Firebase console. |
| Modify | `docs/PRD.md` | Add "User feedback" feature description + Feature Status row + Known Limitations entry. |

Each file has one responsibility and is small. No cross-cutting refactors.

---

## Task 1 — `submitFeedback` helper in `src/firebase.ts` (TDD)

**Files:**
- Create: `src/firebase.test.ts`
- Modify: `src/firebase.ts` (append new export near the bottom of the existing helpers section)

- [ ] **Step 1.1: Inspect the current end of `src/firebase.ts` so you know where the new export will sit**

Run:

```bash
tail -40 src/firebase.ts
```

Expected: the file ends with the existing `deleteShareCode` / `restoreArrays` / similar helpers, no `submitFeedback` yet. Note the existing imports of `trackError` (from `./services/telemetry`) and the shared `formatErrorMessage` helper — the new function will reuse both.

- [ ] **Step 1.2: Write the failing tests at `src/firebase.test.ts`**

Create file `src/firebase.test.ts` with exactly the following content. The pattern mirrors `src/services/sync/__tests__/firebaseSyncService.test.ts` (mock `firebase/database` and `@/services/telemetry`). We additionally mock `firebase/app` so that `getFirebaseApp`'s dynamic import resolves without hitting real Firebase.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({ name: 'mock-app' })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: 'mock-app' })),
}));

vi.mock('firebase/database', () => ({
  getDatabase: vi.fn(() => ({ __mock: 'db' })),
  ref: vi.fn((_db: unknown, path: string) => ({ path })),
  push: vi.fn().mockResolvedValue({ key: 'mock-id' }),
  serverTimestamp: vi.fn(() => 'SERVER_TS_SENTINEL'),
}));

vi.mock('@/services/telemetry', () => ({
  trackError: vi.fn(),
  trackEvent: vi.fn(),
}));

import * as firebaseDb from 'firebase/database';
import { submitFeedback } from './firebase';
import { trackError } from '@/services/telemetry';

describe('submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects empty text without hitting Firebase', async () => {
    const result = await submitFeedback('');
    expect(result).toEqual({ success: false, error: 'Feedback cannot be empty.' });
    expect(firebaseDb.push).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only text without hitting Firebase', async () => {
    const result = await submitFeedback('   \n\t  ');
    expect(result).toEqual({ success: false, error: 'Feedback cannot be empty.' });
    expect(firebaseDb.push).not.toHaveBeenCalled();
  });

  it('rejects text longer than 2000 characters without hitting Firebase', async () => {
    const result = await submitFeedback('x'.repeat(2001));
    expect(result).toEqual({
      success: false,
      error: 'Feedback is too long (max 2000 characters).',
    });
    expect(firebaseDb.push).not.toHaveBeenCalled();
  });

  it('trims text and pushes { text, timestamp } to /feedback on success', async () => {
    const result = await submitFeedback('   Hello world   ');
    expect(result).toEqual({ success: true });
    expect(firebaseDb.ref).toHaveBeenCalledWith(expect.anything(), 'feedback');
    expect(firebaseDb.push).toHaveBeenCalledTimes(1);
    const pushedPayload = vi.mocked(firebaseDb.push).mock.calls[0][1];
    expect(pushedPayload).toEqual({
      text: 'Hello world',
      timestamp: 'SERVER_TS_SENTINEL',
    });
  });

  it('reports failure and records telemetry when push throws', async () => {
    vi.mocked(firebaseDb.push).mockRejectedValueOnce(new Error('network down'));
    const result = await submitFeedback('some real feedback');
    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(trackError).toHaveBeenCalledWith(
      'feedback_submit_failed',
      expect.objectContaining({ message: 'network down' }),
    );
  });
});
```

- [ ] **Step 1.3: Run the new tests and confirm they fail**

Run:

```bash
npx vitest run src/firebase.test.ts
```

Expected: all five tests fail because `submitFeedback` is not yet exported from `./firebase`.

- [ ] **Step 1.4: Implement `submitFeedback` in `src/firebase.ts`**

Open `src/firebase.ts`. Append the following export at the bottom of the file, below the existing share-code helpers but above any trailing `restoreArrays` helper export. Do not alter existing code.

```ts
export const submitFeedback = async (
  text: string,
): Promise<{ success: boolean; error?: string }> => {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return { success: false, error: 'Feedback cannot be empty.' };
  }
  if (trimmed.length > 2000) {
    return { success: false, error: 'Feedback is too long (max 2000 characters).' };
  }
  try {
    const { ref, push, serverTimestamp } = await import('firebase/database');
    const db = await getDb();
    await push(ref(db, 'feedback'), {
      text: trimmed,
      timestamp: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    trackError('feedback_submit_failed', error);
    return { success: false, error: formatErrorMessage(error) };
  }
};
```

- [ ] **Step 1.5: Re-run the tests and confirm they pass**

Run:

```bash
npx vitest run src/firebase.test.ts
```

Expected: `Test Files 1 passed`, 5 tests passed.

- [ ] **Step 1.6: Commit**

```bash
git add src/firebase.ts src/firebase.test.ts
git commit -m "feat(feedback): add submitFeedback helper with tests"
```

---

## Task 2 — `FeedbackModal` component (TDD)

**Files:**
- Create: `src/components/modals/FeedbackModal.tsx`
- Create: `src/components/modals/__tests__/FeedbackModal.test.tsx`

- [ ] **Step 2.1: Write the failing component tests at `src/components/modals/__tests__/FeedbackModal.test.tsx`**

Create the file with exactly the following content:

```tsx
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
```

- [ ] **Step 2.2: Run the tests and confirm they fail**

Run:

```bash
npx vitest run src/components/modals/__tests__/FeedbackModal.test.tsx
```

Expected: module-resolution failure because `../FeedbackModal` does not exist yet.

- [ ] **Step 2.3: Implement `FeedbackModal` at `src/components/modals/FeedbackModal.tsx`**

Create the file with exactly the following content:

```tsx
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
      title="Send feedback"
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
```

- [ ] **Step 2.4: Run the tests and confirm they pass**

Run:

```bash
npx vitest run src/components/modals/__tests__/FeedbackModal.test.tsx
```

Expected: `Test Files 1 passed`, all 7 tests passed.

- [ ] **Step 2.5: Commit**

```bash
git add src/components/modals/FeedbackModal.tsx src/components/modals/__tests__/FeedbackModal.test.tsx
git commit -m "feat(feedback): add FeedbackModal with textarea, char counter, and error surface"
```

---

## Task 3 — Wire "Send feedback" into `ProfileMenu`

**Files:**
- Modify: `src/components/panels/ProfileMenu.tsx`

No dedicated test — `ProfileMenu` has no existing tests, and both `submitFeedback` and `FeedbackModal` are covered above. Manual test is in Step 3.5.

- [ ] **Step 3.1: Add the `MessageSquare` import**

Open `src/components/panels/ProfileMenu.tsx`. Find the existing `from 'lucide-react'` import block (it pulls in `User`, `Download`, `Upload`, `Share2`, `Compass`, `LogOut`, `LogIn`, `Check`, and `Lock`). Add `MessageSquare` to that same import block, keeping the alphabetical order already in place. Do not add any other icons — only `MessageSquare`.

- [ ] **Step 3.2: Import `FeedbackModal` alongside `AuthModalSimple`**

Find the existing import of `AuthModalSimple` at the top of `ProfileMenu.tsx`. Directly below it, add:

```tsx
import FeedbackModal from '@/components/modals/FeedbackModal';
```

- [ ] **Step 3.3: Add local `showFeedback` state**

Inside the `ProfileMenu` function body, next to the existing `const [showAuth, setShowAuth] = useState(false);` declaration, add:

```tsx
const [showFeedback, setShowFeedback] = useState(false);
```

- [ ] **Step 3.4: Insert the new "Help" section in the dropdown**

Inside `<DropdownMenuContent>`, find the "Navigation section" — the block that starts with a `<DropdownMenuSeparator />` and contains the `onGoHome` item (the "Back to start" entry). Immediately after the closing of that Navigation `<DropdownMenuItem>` (after "Back to start"), and before the Auth-footer `<DropdownMenuSeparator />`, insert:

```tsx
{/* Help section */}
<DropdownMenuSeparator />
<DropdownMenuLabel className="text-[9px] font-extrabold uppercase tracking-widest text-muted-foreground">
  Help
</DropdownMenuLabel>
<DropdownMenuItem onClick={() => setShowFeedback(true)}>
  <div className="size-6 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
    <MessageSquare className="w-3 h-3 text-primary" />
  </div>
  Send feedback
</DropdownMenuItem>
```

- [ ] **Step 3.5: Mount the modal at the bottom of the component**

Find the line `{showAuth && <AuthModalSimple onClose={() => setShowAuth(false)} />}` near the end of the component's JSX. Immediately below it, add:

```tsx
{showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
```

- [ ] **Step 3.6: Verify TypeScript, lint, and formatter all pass**

Run, in sequence:

```bash
npm run lint
npm run build
```

Expected:
- `npm run lint` exits with zero warnings/errors (project is configured for `--max-warnings=0`).
- `npm run build` completes with `vite build` reporting no TypeScript errors.

If lint complains about import ordering, run `npm run format` to let Prettier fix it, then re-run `npm run lint`.

- [ ] **Step 3.7: Manual smoke test**

Start the dev server and exercise the flow:

```bash
npm run dev
```

In a browser at `http://localhost:5173/itinerary-planner/`:

1. Open the avatar dropdown (top-right).
2. Confirm the new **Help → Send feedback** item is visible, with the `MessageSquare` icon.
3. Click it → the modal opens. The Send button is disabled until you type.
4. Type ~20 chars → char counter shows `20/2000`.
5. Click **Send** → toast "Thanks — feedback sent." appears and the modal closes.
6. Open your Firebase console → Realtime Database → `/feedback` → a new autoId entry exists with only `text` and `timestamp` (no `uid`, no `email`). *(Note: this step only works after Task 4's rules are applied; before then, the write may fail at the security rule step — that is expected.)*
7. Reopen the modal, test Cancel (should close without submitting), and test very long text (should cap at 2000 chars in the textarea).

Stop the dev server when finished.

- [ ] **Step 3.8: Commit**

```bash
git add src/components/panels/ProfileMenu.tsx
git commit -m "feat(feedback): wire Send feedback entry into ProfileMenu dropdown"
```

---

## Task 4 — Firebase RTDB security rules

**Files:**
- Create: `firebase.feedback.rules.json` (repo root, for reference + version history)

The live rules live in the Firebase console. This task checks a reference copy into the repo and flags the manual console step.

- [ ] **Step 4.1: Create `firebase.feedback.rules.json` at the repo root**

Create the file with exactly:

```json
{
  "rules": {
    "feedback": {
      ".read": false,
      "$id": {
        ".write": "!data.exists()",
        ".validate": "newData.hasChildren(['text', 'timestamp'])",
        "text": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 2000"
        },
        "timestamp": {
          ".validate": "newData.val() == now"
        }
      }
    }
  }
}
```

- [ ] **Step 4.2: Merge the `feedback` block into the live RTDB rules (manual console step)**

Open the Firebase console → Realtime Database → **Rules** tab. Do **not** replace existing rules; the current rules protect `/itineraries` and must remain. Merge the `feedback` key into the existing top-level `rules` object, then **Publish**.

Example of the merged structure (the `itineraries` rules on your DB will differ — keep whatever is already there, just add `feedback` as a sibling):

```json
{
  "rules": {
    "itineraries": {
      /* …existing rules, keep as-is… */
    },
    "feedback": {
      ".read": false,
      "$id": {
        ".write": "!data.exists()",
        ".validate": "newData.hasChildren(['text', 'timestamp'])",
        "text": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 2000"
        },
        "timestamp": {
          ".validate": "newData.val() == now"
        }
      }
    }
  }
}
```

Click **Publish**. The Simulator tab can be used to dry-run a write at `/feedback/test1` with `{ text: "hi", timestamp: {".sv": "timestamp"} }` and confirm it is allowed, and a read at `/feedback` and confirm it is denied.

- [ ] **Step 4.3: Re-run the manual smoke test from Task 3.7, steps 5–6**

With the rules now live, typing + Send should succeed and the entry should appear in the console under `/feedback/{autoId}`.

- [ ] **Step 4.4: Commit the reference rules file**

```bash
git add firebase.feedback.rules.json
git commit -m "chore(feedback): add reference RTDB rules snippet for /feedback"
```

---

## Task 5 — Update `docs/PRD.md`

**Files:**
- Modify: `docs/PRD.md`

- [ ] **Step 5.1: Add a new feature subsection under `## Features`**

Open `docs/PRD.md`. Locate the `## Features` section (around line 30). Insert a new `### User Feedback` subsection at the end of the Features section, just before the `## Data Model (v3)` heading. Use exactly:

```markdown
### User Feedback

Anonymous free-text feedback from any user (signed in or guest). Entry point is the `ProfileMenu` → "Help" → "Send feedback". Submissions are persisted to Firebase Realtime Database at `/feedback/{autoId}` with only `{ text, timestamp }` — no user identity, user agent, or trip context is attached. Client-side cap is 2000 characters; the RTDB rules reject reads and re-enforce the length cap server-side.
```

- [ ] **Step 5.2: Add a row to the `## Feature Status` table**

In the existing Feature Status table, add a row immediately below the "Share via Code" row:

```markdown
| User feedback               | ✅     | Anonymous free-text submissions from ProfileMenu → Firebase RTDB `/feedback`; no identity attached                                                                                                                                                                      |
```

Keep the column alignment consistent with neighbouring rows.

- [ ] **Step 5.3: Add an entry to `## Known Limitations`**

Append a new bullet to the Known Limitations list:

```markdown
- **No in-app feedback reader** — feedback submissions are viewable only via the Firebase console; no admin UI, no reply workflow, and no rate limiting beyond the RTDB length validation.
```

- [ ] **Step 5.4: Verify Prettier is happy**

Run:

```bash
npm run format:check
```

If it reports issues on `docs/PRD.md`, run `npm run format` to auto-fix, then re-run `format:check`. Expected final state: clean exit.

- [ ] **Step 5.5: Commit**

```bash
git add docs/PRD.md
git commit -m "docs: document user feedback feature in PRD"
```

---

## Task 6 — Full verification

**Files:** none modified.

- [ ] **Step 6.1: Run the full test suite**

Run:

```bash
npm run test
```

Expected: all tests pass, including the two new files added in Tasks 1 and 2.

- [ ] **Step 6.2: Run the build**

Run:

```bash
npm run build
```

Expected: clean TypeScript check and successful Vite production bundle.

- [ ] **Step 6.3: Run the linter**

Run:

```bash
npm run lint
```

Expected: zero warnings, zero errors.

- [ ] **Step 6.4: Confirm branch and commit log**

Run:

```bash
git log --oneline main..HEAD
```

Expected: five commits on `feat/user-feedback` — submitFeedback, FeedbackModal, ProfileMenu wiring, RTDB rules reference, PRD update. No co-author tags.

- [ ] **Step 6.5: Hand back to user**

Summarise to the user:

- Feature shipped on `feat/user-feedback`.
- Firebase console rules were published manually (Task 4.2).
- Suggest opening a PR against `main` when ready.

Do **not** open a PR or push without explicit user approval.
