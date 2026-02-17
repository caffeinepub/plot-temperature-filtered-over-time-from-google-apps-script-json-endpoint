# Specification

## Summary
**Goal:** Ensure the Conceptmachine Google Sheets download link is only accessible to admins, and allow admins to see a list of current admins on the Profile page.

**Planned changes:**
- Remove the Conceptmachine Google Sheets URL from any public frontend constants/config and fetch it via a new admin-only backend method.
- Update the title bar to render the download button (left of the dark mode toggle) only for admins; clicking it opens the fetched URL in a new tab.
- Add new admin-only backend query to return the current admin principals (and display names when available).
- Add an admin-only “Admins” section on the Profile page that lists admins in stable order with copy-friendly principal formatting.
- Add/extend React Query hooks to call the new backend endpoints only when needed, with loading and non-blocking error handling on the Profile page.

**User-visible outcome:** Non-admin users no longer see (or can obtain) the Conceptmachine download link; admins continue to see the download button and can view a list of current admins on their Profile page.
