# Specification

## Summary
**Goal:** Fix the "Flow control (Pa)" line color in FanVoltageFlowControlChart and auto-zoom all charts to the last day of data on page load.

**Planned changes:**
- In `FanVoltageFlowControlChart.tsx`, correct the "Flow control (Pa)" line color so it is black in light mode and white in dark mode (currently inverted).
- On initial page load, automatically set the visible time window of all charts (TemperatureChart, CO2Chart, CoolingHeatingVentilationChart, FanVoltageFlowControlChart, TSICSensorChart) to the last 24 hours of available data.
- Ensure users can still manually zoom out or drag the Brush to view the full dataset.

**User-visible outcome:** The "Flow control (Pa)" line displays the correct color per theme, and every chart opens already zoomed into the most recent day of data while still allowing the user to pan/zoom out to the full history.
