# Share Code UI Refinements

**Date:** 2026-04-16
**Status:** Approved
**Context:** Refinements to the export-to-code feature implemented earlier today

## Summary

Three targeted UI changes to improve the share code UX:
1. Replace small header icons with a dedicated share status bar below the header
2. Remove "save copy before update" — pull always overwrites
3. Add "Import from code" button on the WelcomeScreen

## Change 1: Share Status Bar

Replace the current share indicator buttons in the header (hidden sm:flex buttons at lines 1044-1077 of App.tsx) with a contextual bar rendered below the header, at the same level as the sync error banner.

The bar only appears when the active trip has `shareCode` or `sourceShareCode`.

### Owner View (`trip.shareCode` exists)

A subtle bar showing the active code, mode, and actions:
- Left: link icon + "Shared as TRIP-ABC123" + mode badge ("Read only" or "Writable")
- Right: "Push changes" button + "Manage" button (opens ShareTripDialog)

### Importer View (`trip.sourceShareCode` exists)

- Left: link icon + "Linked to TRIP-ABC123"
- Right: "Pull latest" button (disabled with "Up to date" text when no update available)
- When update is available: bar gets info/blue highlight background, "Pull latest" button is prominent

### Importer + Writable Mode

Same as importer view but also shows a "Push changes" button alongside "Pull latest".

### Styling

- Same height/padding as sync error banner (`px-4 py-2 text-xs border-b`)
- Default state: `bg-muted/30 border-border/50` (subtle, not attention-grabbing)
- Update available: `bg-info/10 border-info/20 text-info` (highlighted)
- Buttons: `variant="ghost" size="sm"` for secondary actions, `variant="default" size="sm"` for "Pull latest" when update available

### Removed

Delete the 3 share indicator `<button>` elements currently in the header (trip.shareCode badge, sourceShareCode link icon, writable upload icon).

## Change 2: Simplify Pull Latest

Remove the "save copy before update" option entirely.

### UI Change

Replace the current 3-button pull confirm dialog with a simpler confirmation:
- Title: "Pull latest version?"
- Description: "This will replace your current trip data with the latest version from the shared code."
- Buttons: "Cancel" and "Pull latest"

### Code Changes

- `pullLatest` in `useShareCode.ts`: remove `saveCopy` parameter and the copy/addTrip logic. Always overwrites directly.
- `handlePullLatest` in `App.tsx`: remove `saveCopy` parameter, just calls `pullLatest()`.
- Pull confirm dialog: two buttons instead of three.

## Change 3: Import from Code on WelcomeScreen

Add an "Import from code" button to the WelcomeScreen hero section alongside "Plan a trip" and "See a demo".

### UI

```
[Plan a trip]  [See a demo]  [Import from code]
```

- "Import from code" uses `variant="outline"` — same visual weight as "See a demo"
- Clicking opens the existing `ImportFromCodeDialog`

### Props Change

Add `onImportFromCode: () => void` to WelcomeScreen props. Wire it in App.tsx to open the ImportFromCodeDialog (same handler used by ProfileMenu).

### Flow

1. User arrives at app, not logged in
2. Sees "Import from code" button on landing page
3. Clicks it → ImportFromCodeDialog opens
4. Enters code → trip imported → redirected to the trip view
5. No login required
