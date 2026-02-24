# Specification

## Summary
**Goal:** Disable chart animations across all graph components by adding `isAnimationActive={false}` to all Recharts series components.

**Planned changes:**
- Add `isAnimationActive={false}` to all series components (Line, Bar, Area, etc.) in `CO2Chart.tsx`
- Add `isAnimationActive={false}` to all series components in `TemperatureChart.tsx`
- Add `isAnimationActive={false}` to all series components in `CoolingHeatingVentilationChart.tsx`
- Add `isAnimationActive={false}` to all series components in `FanVoltageFlowControlChart.tsx`
- Add `isAnimationActive={false}` to all series components in `TSICSensorChart.tsx`

**User-visible outcome:** All charts render and update instantly without any animation effects.
