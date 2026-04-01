# Conceptmachine Dashboard

## Current State
Events in the Advanced Chart section have: `id`, `timestamp` (ms epoch), `label`. No incubation time concept exists. Events are listed in a static order.

## Requested Changes (Diff)

### Add
- `testStartMs?: number` field to `AdvancedChartConfig` (stored in advancedConfigJson per logger ID)
- `displayOrder?: number` field to `EventConfig` for drag-and-drop visual ordering
- Incubation time display and input per event row (format: D## H## M##)
- When user edits incubation time for any event: recalculate `testStartMs = event.timestamp - incubationMs`, then all other events show auto-computed incubation time
- If `testStartMs` is set but no event exists exactly at that timestamp, show a synthetic read-only "START" event at the top (D00 H00 M00) — not stored, just displayed
- If a user creates an event with incubation D00 H00 M00, that event IS the START event
- Drag-and-drop reordering of event rows (visual order only — timestamp and incubation values don't change)

### Modify
- `EventConfig` interface: add optional `displayOrder?: number`
- `EventRow` component: add incubation time field (editable), recalculate all events when changed
- `AdvancedChartConfig`: add `testStartMs?: number`
- Event list rendering: sort by `displayOrder`, render drag handles with @dnd-kit (already installed)

### Remove
- Nothing removed

## Implementation Plan
1. Extend `EventConfig` with `displayOrder?: number`
2. Extend `AdvancedChartConfig` with `testStartMs?: number`
3. Add incubation time parse/format helpers: `msToIncubation(ms)` → `"D05 H14 M30"`, `incubationToMs("D05 H14 M30")` → ms
4. Update `EventRow` to show incubation field; on blur, compute new `testStartMs` and trigger recalc of all events
5. Add synthetic START event rendering when `testStartMs` is set and no real event is at that time
6. Wire @dnd-kit `DndContext` + `SortableContext` around the events list for drag-to-reorder (update `displayOrder` on drop)
7. All changes are frontend-only — persisted via existing `advancedConfigJson` save flow
