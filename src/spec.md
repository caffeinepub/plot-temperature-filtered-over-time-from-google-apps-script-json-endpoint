# Specification

## Summary
**Goal:** Remove the header logo entirely and ensure all CO₂ data is displayed consistently in percent (%) across parsing and chart UI.

**Planned changes:**
- Remove the logo `<img>` and any logo-specific wrapper/spacing or logo-related UI from the dashboard header, leaving only the existing title/subtitle text block.
- Update CO₂ parsing so `CO2 CSV(%)` stays in its original percent unit (no x10000), while `CO2 Rechts` and `CO2 Links` are each scaled by multiplying by `0.001`.
- Update CO₂ chart legend/tooltip/axis labeling to use percent wording only (no “ppm”), and label the CO₂ CSV series exactly as `CO2 CSV (%) - dashed`.

**User-visible outcome:** The dashboard header shows only the title and subtitle (no logo), and the CO₂ chart displays three series all in % with correct labels and axis unit.
