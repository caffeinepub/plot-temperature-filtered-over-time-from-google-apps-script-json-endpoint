# TSIC & Conceptmachine Chart Improvements

## Current State
- TSICLoggersPage has a Chart Controls card with Date Range inputs (DD/MM/JJJJ), Reset Zoom button, and Y-Axis min/max inputs (Auto/Auto)
- TemperatureDashboardPage has a Date Range filter card
- TSIC main chart and Advanced chart use same flex side-panel for hover, but styling/sizing differs slightly
- Hover side panel in TSICLoggersPage causes flicker: panel returns null when no hover, causing chart width to shift as panel appears/disappears
- No Y-axis scroll-to-zoom on any chart
- Conceptmachine charts have no Y-axis scroll zoom

## Requested Changes (Diff)

### Add
- Y-axis scroll-to-zoom (mousewheel) on TSIC main chart container
- Y-axis scroll-to-zoom (mousewheel) on Advanced chart container
- Y-axis scroll-to-zoom (mousewheel) on all 4 Conceptmachine charts (Temperature, CO2, CoolingHeatingVentilation, FanVoltageFlowControl)
- Small 'scroll to zoom Y' hint label on each chart that has scroll-zoom

### Modify
- Hover flicker fix: HoverSidePanel in TSICLoggersPage always reserves w-44 space (render empty div when no data, not null). Same fix for AdvancedChartSection's hover panel. This prevents chart width from changing on mouse enter/leave.
- Make TSIC main chart and Advanced chart hover panels identical in style (same card, same font sizes, same padding)
- Color mode toggle (By Group / By Sensor Name) moved out of Chart Controls card to just above the Sensor Groups collapsible section, so it stays after the card is removed

### Remove
- Entire Chart Controls card from TSICLoggersPage (removes Date Range inputs, Reset Zoom button, Y-Axis min/max Auto inputs) — Y-axis scroll zoom replaces the Y-axis inputs; Brush + drag-zoom replaces date range controls
- Date Range filter card from TemperatureDashboardPage — drag-zoom on charts replaces it

## Implementation Plan
1. In TSICLoggersPage.tsx:
   - Remove Chart Controls card entirely
   - Move color mode toggle (By Group / By Sensor Name) above the SensorGroupManager collapsible
   - Fix HoverSidePanel: always render the w-44 container div even when groups is null/empty (show empty div, not null)
   - Pass yAxisMin/yAxisMax state managed by scroll-wheel handler to TSICSensorChart
   - Add onWheel handler on chart wrapper that adjusts yAxisMin/yAxisMax
2. In AdvancedChartSection.tsx:
   - Fix hover panel: always render w-44 container div
   - Match hover panel style to TSICLoggersPage HoverSidePanel
   - Add onWheel handler for Y-axis scroll zoom on the advanced chart wrapper
   - Remove inline Y-axis input controls (replaced by scroll zoom)
3. In TSICSensorChart.tsx:
   - Accept yAxisMin/yAxisMax as controlled props (already does), remove any internal Y-axis input rendering if present
4. In TemperatureDashboardPage.tsx:
   - Remove Date Range filter card
5. In TemperatureChart.tsx, CO2Chart.tsx, CoolingHeatingVentilationChart.tsx, FanVoltageFlowControlChart.tsx:
   - Add onYDomainChange callback prop
   - Add onWheel handler on chart container that calls onYDomainChange with new min/max
   - Expose yMin/yMax as controlled props accepted from parent
   - Add scroll hint text
