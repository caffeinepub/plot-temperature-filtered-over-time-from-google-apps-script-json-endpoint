# R&D Dashboard – Backup Page

## Current State
- Admin-only multi-page dashboard (TSIC Loggers, Conceptmachine, Profile, Image Copies)
- TSIC Loggers shows per-ID sensor charts with persistent sensor groups, sensor labels, and advanced chart config (formulas/bands/events)
- All config is stored in Motoko stable variables (sensorGroupsPerIdJson, advancedChartConfigPerIdJson, sensorLabels)
- No backup functionality exists

## Requested Changes (Diff)

### Add
- **Backend**: `backupsPerIdJson` Map<Nat, Text> stable variable – stores JSON array of BackupEntry per logger ID
- **Backend**: `getBackupsForId(id: Nat): async Text` (admin only query)
- **Backend**: `saveBackupsForId(id: Nat, json: Text): async ()` (admin only update)
- **Frontend**: `BackupPage.tsx` – admin-only page listing all backups by logger ID. Shows label, timestamp per backup. Delete button per backup. "View" button loads live GAS data + backup config and shows an interactive chart.
- **Frontend**: "Save Backup" button on TSICLoggersPage (admin only, when an ID is loaded). Opens a dialog to name the backup, then saves: current sensorGroupsJson + advancedConfigJson + sensorLabelsJson.
- **Navigation**: Add "Image Copies" and "Backups" pages to logSystemPages (both admin-only).

### Modify
- `logSystemPages.ts`: Add BackupPage entry (id: "backups", displayName: "Backups")
- `App.tsx`: Filter backup and image-copies pages to only show for admins
- `TSICLoggersPage.tsx`: Add "Save Backup" button (Camera+Archive icon, admin only)
- `declarations/backend.did.js` and `backend.did.d.ts` and `backend.d.ts`: add new methods

### Remove
- Nothing removed

## Implementation Plan
1. Update main.mo: add backupsPerIdJson variable + getBackupsForId + saveBackupsForId
2. Update all declaration files to include the new backend functions
3. Create BackupPage.tsx with list view and inline chart preview
4. Update TSICLoggersPage.tsx to add Save Backup button with label dialog
5. Update logSystemPages.ts to add Backups page
6. Update App.tsx to filter admin-only pages (backups, image-copies) from non-admins

## BackupEntry TypeScript shape (stored as JSON in backend)
```typescript
type BackupEntry = {
  id: string; // uuid
  loggerId: number;
  label: string;
  timestampMs: number;
  sensorGroupsJson: string;
  advancedConfigJson: string;
  sensorLabelsJson: string; // JSON.stringify([[sensorNum, label], ...])
};
```

## Notes
- Raw sensor data is NOT stored (too large for ICP message limits). The backup captures configuration state only.
- When viewing a backup, live data is fetched from the GAS endpoint for that logger ID.
- If the GAS data is unavailable (>19 days old), the chart shows empty but config is still visible.
