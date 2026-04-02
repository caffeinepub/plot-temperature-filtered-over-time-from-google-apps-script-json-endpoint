# R&D Data Logger Dashboard

## Current State
The Conceptmachine page has 4 time-series charts (Temperature, CO2, Cooling/Heating/Ventilation, Fan/Flow Control). There is no Advanced section. The TSIC Loggers page has a full AdvancedChartSection with formulas, bands, events, and hover legend.

The backend stores advanced chart config per TSIC logger ID as JSON blobs via `getAdvancedChartConfigForId(id)` / `saveAdvancedChartConfigForId(id, json)`. There is no global Conceptmachine advanced config storage.

## Requested Changes (Diff)

### Add
- `getConceptMachineAdvancedConfig()` — backend query, returns Text (JSON), admin-only
- `saveConceptMachineAdvancedConfig(json: Text)` — backend update, admin-only
- New stable var `conceptMachineAdvancedConfigJson` in main.mo
- New frontend component `ConceptmachineAdvancedSection.tsx`
- Wire component into `TemperatureDashboardPage.tsx` below the existing charts

### Modify
- `backend.d.ts` — add two new function signatures
- `TemperatureDashboardPage.tsx` — fetch raw data from new endpoint, add Advanced section at bottom

### Remove
- Nothing

## Implementation Plan

### Backend
1. Add `stable var conceptMachineAdvancedConfigJson : Text = ""` to main.mo
2. Add `getConceptMachineAdvancedConfig()` public query (admin-only, returns the JSON string)
3. Add `saveConceptMachineAdvancedConfig(json)` public shared (admin-only, saves JSON string)
4. Update backend.d.ts with the two new function signatures

### Frontend — ConceptmachineAdvancedSection.tsx
New self-contained component. Keep it simple:
- Collapsible panel (collapsed by default)
- **Multiple tabs**: each tab has a name, list of FormulaLine[], list of BandConfig[]
- Tab bar: click to switch, + button to add tab, rename (double-click), delete (x button)
- Per tab: formula editor rows (name, expression using the 24 variable names, color, L/R Y-axis toggle, bold, dotted, visible, delete)
- Per tab: band editor rows (name, sensor list, color, L/R Y-axis toggle, visible, delete)
- Reference list of 24 variable names always visible (collapsed by default or as a small expandable)
- Chart: ComposedChart with left + right YAxis, Lines for formulas, BandPolygon for bands
- Hover legend: fixed right panel on desktop, below chart on mobile (same pattern as TSIC Advanced)
- No events
- Raw data fetched from new endpoint URL, parsed to { timestamp, Temperature, TemperatureFiltered, ... } objects
- Config persisted globally via `saveConceptMachineAdvancedConfig`

### Data mapping (raw JSON key → variable name)
- `Temperature(F)` → `Temperature`
- `Temperature Filtered(F)` → `TemperatureFiltered`
- `Temperature CSV(F)` → `TemperatureCSV`
- `Fan 1(V)` → `Fan1`
- `Fan 2(V)` → `Fan2`
- `Fan 3(V)` → `Fan3`
- `Heating(PWM)` → `HeatingPWM`
- `Heating(%)` → `HeatingPct`
- `Cooling(V)` → `CoolingV`
- `Min value cooling(V)` → `MinCoolingV`
- `Max value Cooling(V)` → `MaxCoolingV`
- `Ventilation(V)` → `VentilationV`
- `Max value ventilation(V)` → `MaxVentilationV`
- `Min value ventilation(V)` → `MinVentilationV`
- `Max value heating(V)` → `MaxHeatingV`
- `Min value heating(V)` → `MinHeatingV`
- `Stuursignaal debiet(Pa)` → `FlowControlPa`
- `CO2 CSV(%)` → `CO2CSV`
- `CO2 Rechts` → `CO2Right`
- `CO2 Links` → `CO2Left`
- `P` → `P`
- `I` → `I`
- `Kp` → `Kp`
- `Ti(s)` → `Ti`

### Wire-up in TemperatureDashboardPage.tsx
- Add `<ConceptmachineAdvancedSection isAdmin={isAdmin} />` after the last DashboardCard
- The component fetches its own raw data internally (separate from the parsed TemperatureSeries)
