# TSIC Loggers – Backup UX Improvements

## Current State
- Backup view appears BELOW the main chart (both are visible simultaneously)
- Save Backup and Backups dropdown buttons are inside the overflow-x-auto scroll container, below the ID buttons
- Ungrouped sensors use a hue-derived color (labelToHue)
- BackupViewSection has no group management panel — you can only see the chart but cannot toggle group visibility or change group colors
- Sensors can be dragged between groups in the main SensorGroupManager

## Requested Changes (Diff)

### Add
- Backup group manager panel inside BackupViewSection that allows: toggling group/sensor visibility, changing group colors, toggling bold/dotted per sensor — but NOT renaming sensors, NOT moving sensors between groups, NOT drag-and-drop reorder

### Modify
- When a backup is selected (`selectedBackup !== null`), hide the main chart/controls/advanced section — show ONLY the BackupViewSection
- Move the Save Backup and Backups buttons outside the `overflow-x-auto` container so they sit to the right of the ID buttons row (in the same card, flex row)
- Ungrouped sensors: use grey (#9ca3af) color in both main TSIC view and backup view instead of hue-derived colors

### Remove
- Nothing removed

## Implementation Plan
1. **TSICLoggersPage.tsx**: Wrap the data display section (Chart Controls, Sensor Groups, Chart, Advanced) with `{!selectedBackup && (...)}` so it hides when backup is active
2. **TSICLoggersPage.tsx**: Restructure the ID selector card — use `flex items-start gap-4` at the outer level; put `overflow-x-auto` div with ID buttons on the left (flex-1), and put Save Backup + Backups buttons on the right (flex-shrink-0) — both at same level outside overflow container
3. **useSensorGroups hook / getSensorColor**: Make ungrouped sensors return `#9ca3af` (grey) instead of `labelToHue` derived color
4. **BackupViewSection.tsx**: Add a collapsible `BackupGroupPanel` that shows groups with: color picker dot (click to change), eye toggle per group, eye toggle per sensor, B/D buttons per sensor. Wired to local state (not persisted to backend). No drag handles, no rename, no add/remove sensor.
