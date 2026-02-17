# Specification

## Summary
**Goal:** Rebuild the admin module so admin access control is reliable, persists across canister upgrades, and supports granting admin rights from the existing Profile section.

**Planned changes:**
- Update backend admin/access-control storage so granted admins persist across canister upgrades/redeploys and admin-guarded methods continue to enforce access correctly.
- Implement initial-admin rules in the backend: the first-ever Internet Identity login becomes admin (one-time) and the hardcoded Principal `nq44w-zh7mz-vkidk-kanua-rfijv-g2ail-o6b4k-ts6iu-qwwlh-e4le5-vqe` is always admin.
- Ensure stable admin listing APIs: `getAllAdmins()` returns a de-duplicated list including the hardcoded admin plus granted admins and remains accurate after upgrades.
- Rebuild the Profile page admin controls flow so admins can grant admin by entering a Principal ID, the list updates after success without full reload, invalid Principal IDs are rejected with a clear error, and non-admins do not see admin controls.

**User-visible outcome:** Admin users can grant admin rights to another user by Principal ID from the Profile page and immediately see the updated admin list; admin access and admin lists remain correct even after redeploys/upgrades, with the first-ever Internet Identity login and the fixed Principal always recognized as admins.
