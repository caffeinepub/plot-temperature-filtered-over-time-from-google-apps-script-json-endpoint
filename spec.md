# TSIC Logger Dashboard

## Current State
- ConceptmachineAdvancedSection.tsx has chart height at 400px
- No vertical hover line (ReferenceLine) in the advanced chart
- No Brush component for horizontal scroll/zoom synchronization
- Formula evaluator supports only avg(), min(), max(), median(), range()
- Band expressions only accept plain variable names, no arithmetic
- clamp() function not supported

## Requested Changes (Diff)

### Add
- clamp(expr, min, max) function support in formula evaluator (for ConceptmachineAdvancedSection)
- Vertical dashed ReferenceLine on hover (hoverX) in ConceptmachineAdvancedSection chart
- Brush component at bottom of ConceptmachineAdvancedSection chart (same as AdvancedChartSection)
- Arithmetic expressions in band min/max inputs (e.g. Temperature*100, CoolingV/10)

### Modify
- Chart height in ConceptmachineAdvancedSection: 400px → 900px (double)
- preprocessCmFunctions(): add clamp(expr, min, max) case
- Band row expression parser: allow full arithmetic expressions (not just plain variable names)
- Formula helper text: update to include clamp() and note that full arithmetic is supported in band expressions

### Remove
- Nothing removed

## Implementation Plan
1. In ConceptmachineAdvancedSection.tsx:
   a. Change ResponsiveContainer height from 400 to 900
   b. Add hoverX state and ReferenceLine in the chart (copy pattern from AdvancedChartSection)
   c. Add Brush component below the chart (copy from AdvancedChartSection, adapt for CM data)
   d. Add clamp() to preprocessCmFunctions() — evaluates inner expression first, then clamps to [min, max]
   e. Update band evaluation to use evaluateCmFormula() for min/max expressions instead of just plain variable lookup
   f. Update the functions helper text in the UI
