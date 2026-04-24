# User feedback component — design

Date: 2026-04-24
Status: approved, ready for implementation plan

## Problem

The app is publicly released but still in active development. There is no channel for real users to report bugs, propose features, or give general feedback. We want a lightweight, always-available way for any visitor (signed in or not) to submit a free-text message that we can read in the Firebase Realtime Database console.

## Goals

- Any user — including signed-out guests — can submit feedback.
- Submissions are fully anonymous: no user identity, no device fingerprint, no trip context.
- Storage is simple plain-text records in Firebase RTDB.
- Discoverable without adding UI chrome to an already dense layout.
- Reasonable guardrails against accidental abuse and runaway cost, without turning the feature into spam-mitigation infrastructure.

## Non-goals

- No in-app admin UI for reading feedback — RTDB console is sufficient.
- No reply/email workflow. Anonymous submissions cannot be replied to.
- No categorization, tagging, attachments, or screenshots.
- No rate limiting, captcha, or abuse detection beyond what Firebase rules give us for free.
- No E2E tests.

## Decisions (locked during brainstorming)

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Entry point: new "Send feedback" item inside the existing `ProfileMenu` dropdown, in a new "Help" section between Navigation and the Auth footer. | Avoids new chrome on an already dense layout. Users looking for feedback controls naturally land in the profile/settings surface. |
| 2 | Always allowed, always anonymous — even when a user is signed in, no uid/email is attached. | User intent: maximize participation (most public users are guests) and preserve submitter privacy. |
| 3 | Payload = `{ text, timestamp }` only. No user-agent, app version, or trip context. | Simplest record, avoids re-identification through trip names, aligns with "anonymous" promise. |
| 4 | Guardrails: Firebase RTDB security rule `.read: false` + server-side length validation, client-side `maxLength={2000}` on the textarea. No client rate limiting. | Minimum floor needed to avoid accidental cost/DoS and to block casual listing. User chose to keep the rest trust-based. |
| 5 | UX: single modal built on `ModalBase` with textarea + char counter + Submit + Cancel. On success: close modal, clear text, sonner toast "Thanks — feedback sent". On failure: inline `ErrorMessage`, modal stays open with text intact. | Matches existing modal conventions and error patterns in the codebase. |
| 6 | Firebase integration: new `submitFeedback` export in `src/firebase.ts`, matching the pattern used by `saveItinerary` (dynamic `firebase/database` import, use `push` at `/feedback`, route failures through `trackError` + `formatErrorMessage`). | Consistent with existing RTDB helpers. No need for a separate service module at this scale. |

## Architecture

```
ProfileMenu (existing dropdown)
  └─ new "Help" section
       └─ DropdownMenuItem "Send feedback"  ──►  setShowFeedback(true)

FeedbackModal (new, rendered when showFeedback === true)
  ├─ Textarea (controlled, maxLength=2000)
  ├─ char counter (0/2000)
  ├─ ErrorMessage (inline, on submit failure)
  └─ Submit button
       └─ submitFeedback(text)  →  src/firebase.ts
                                     └─ push(ref(db, 'feedback'), { text, timestamp })
                                           → RTDB /feedback/{autoId}
```

Files touched:

- **New** — `src/components/modals/FeedbackModal.tsx`
- **Modified** — `src/components/panels/ProfileMenu.tsx` (new section + local state + modal mount)
- **Modified** — `src/firebase.ts` (new `submitFeedback` export)
- **Firebase console** — RTDB security rules (see below)

`App.tsx` is untouched. Feedback modal visibility state lives inside `ProfileMenu` alongside the existing `showAuth` and `showSignOutConfirm` state, since the entry point is inside the menu.

## Components

### `FeedbackModal.tsx`

```ts
interface FeedbackModalProps {
  onClose: () => void;
}
```

Internal state:

```ts
const [text, setText] = useState('');
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState<string | null>(null);
```

Structure:

- `ModalBase`
  - `title`: `"Send feedback"`
  - `description`: `"Got an idea, a bug, or general thoughts? Drop it below — we read everything."`
  - `footer`:
    - `cancel`: `{ label: 'Cancel', onClick: onClose }`
    - `primary`: `{ label: 'Send', onClick: handleSubmit, disabled: text.trim().length === 0 || submitting, loading: submitting }`
  - body:
    - `<label htmlFor="feedback-text" className="sr-only">Feedback</label>`
    - `<Textarea id="feedback-text" value={text} onChange={...} rows={6} maxLength={2000} />`
    - char counter `{text.length}/2000` in `text-xs text-muted-foreground`
    - `{error && <ErrorMessage>{error}</ErrorMessage>}`

### `ProfileMenu.tsx` diff

Add:

```ts
const [showFeedback, setShowFeedback] = useState(false);
```

Insert between the Navigation section and the Auth footer:

```tsx
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

Mount alongside the existing modals at the bottom of the component:

```tsx
{showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
```

### `src/firebase.ts` addition

```ts
export const submitFeedback = async (
  text: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
      return { success: false, error: 'Feedback cannot be empty.' };
    }
    if (trimmed.length > 2000) {
      return { success: false, error: 'Feedback is too long (max 2000 characters).' };
    }
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

## Data flow

Storage shape:

```
/feedback
  /-NxXxXxXxX          (firebase autoId)
    text: "the free-text message"
    timestamp: 1713974400000  (server-side epoch ms from ServerValue.TIMESTAMP)
  /-NyYyYyYyY
    ...
```

Modal submit handler:

```ts
const handleSubmit = async () => {
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
```

### Firebase security rules

Applied to the existing RTDB in the Firebase console:

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

- `.read: false` blocks public listing; reads happen only through the Firebase console (owner credentials).
- `".write": "!data.exists()"` blocks overwrite and delete of an existing entry.
- `.validate` enforces the `{ text, timestamp }` shape, the 0–2000 char range, and that the timestamp must be the server `now` (prevents spoofed timestamps).

These rules must coexist with the existing `/itineraries` rules — scoped under the `feedback` key, they do not affect the current share-code path.

## Error handling

| Source | Behavior |
|--------|----------|
| Empty / whitespace-only input | Submit button disabled (primary UX). Defensive check in `submitFeedback` also returns early. |
| Over 2000 chars | Textarea `maxLength` prevents input. Defensive check in `submitFeedback` also returns early. |
| Network failure, RTDB down | `push` throws → caught → `trackError('feedback_submit_failed', ...)` → returns `{ success: false, error: formatErrorMessage(...) }` → modal shows inline `ErrorMessage`, stays open, keeps text so the user can retry. |
| Security rule rejection | Firebase throws `PERMISSION_DENIED` → same path → generic "Could not send feedback. Please try again." message (no rule detail leaked). |
| Firebase not configured (missing env vars) | `getDb()` throws → same path → inline error. The rest of the app works without Firebase; only submit fails. |

Telemetry: `trackError('feedback_submit_failed', error)` on any throw. The feedback text itself is never included in telemetry payloads (we cannot correlate anyway, since entries are anonymous).

Deliberately out of scope:

- No automatic retry loop.
- No offline queue.
- No client-side rate limiting.

## Testing

### Unit tests — `submitFeedback`

New file: `src/firebase.test.ts` (colocated next to `src/firebase.ts`, matching the `src/aiService.test.ts` convention). Mock `firebase/database` the same way `src/services/sync/__tests__/firebaseSyncService.test.ts` does (`vi.mock('firebase/database', ...)` + `import * as firebaseDb from 'firebase/database'`), and mock `@/services/telemetry` to assert `trackError` calls.

- Returns `{ success: false }` for empty string.
- Returns `{ success: false }` for whitespace-only string.
- Returns `{ success: false }` for `> 2000` chars.
- Trims text before push.
- Calls `push` with `ref(db, 'feedback')` and `{ text, timestamp }`.
- Returns `{ success: false, error }` when `push` throws.
- Verifies `trackError` is called when `push` throws.

### Component tests — `FeedbackModal`

New file: `src/components/modals/__tests__/FeedbackModal.test.tsx`. Mock `submitFeedback` from `@/firebase` and `toast` from `sonner`.

- Renders textarea with disabled Send button when empty.
- Send enables after typing non-whitespace text.
- Char counter reflects current length.
- On successful submit: calls `onClose`, calls `toast.success`, clears text before close.
- On failure: shows inline `ErrorMessage`, keeps modal open, preserves typed text.
- Respects `maxLength={2000}`.

### Manual test checklist

Run `npm run dev` and verify:

- Signed-out: menu item visible, modal opens, submit works.
- Signed-in: same — identity is not attached (verify in RTDB console entry has only `text` + `timestamp`).
- Network offline: submit shows inline error, modal stays open.
- 2001 chars: textarea caps at 2000.
- Whitespace only: Send stays disabled.
- Mobile viewport: modal sizes correctly, textarea usable on small screens.
- After submit → RTDB console shows entry under `/feedback`.

## Risks and open questions

- **Cost**: Without client rate limiting, a scripted flood could still grow RTDB usage. The server-side 2000-char validation caps per-record size, and the `!data.exists()` rule prevents inflating a single node, but an attacker could still push many autoIds. Mitigation path if it ever happens: add a captcha or signed-in-only requirement later. Not addressed now.
- **Docs**: This feature changes user-visible behavior, so after implementation `docs/PRD.md` and the Feature Status table must be updated per `CLAUDE.md`. Not adding to `docs/IMPROVEMENTS.md` since this is not from the existing backlog.

## Next step

Hand off to `writing-plans` to produce a step-by-step implementation plan covering: `submitFeedback` + tests, `FeedbackModal` + tests, `ProfileMenu` wiring, security rules rollout (console change flagged), and PRD update.
