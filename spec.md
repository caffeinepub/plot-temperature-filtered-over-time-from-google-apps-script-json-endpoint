# Specification

## Summary
**Goal:** Add admin-only persistent editable text labels beneath each TSIC Logger ID button, stored securely on the backend and never exposed to non-admin users.

**Planned changes:**
- Add a stable backend map in `backend/main.mo` that stores one text label per TSIC Logger ID, surviving canister upgrades.
- Add an admin-only update function to set a label for a given ID and an admin-only query function to retrieve all labels; non-admin callers receive no label data.
- Add a `useTSICLabels` React Query hook that fetches all labels only when the user is confirmed as an admin.
- Add a mutation hook to save a label by ID (invalidates the labels query on success).
- On the TSIC Loggers page, render an editable text input below each ID button only when `useIsCallerAdmin` returns true; non-admin users see nothing in the DOM related to labels.
- The frontend only initiates the label fetch after confirming admin status; label data never enters the React component tree for non-admins.

**User-visible outcome:** Admin users see and can edit a persistent text label beneath each TSIC Logger ID button; the label is saved across page reloads. Non-admin users see no label, no input field, and no related data anywhere in the page or DOM.
