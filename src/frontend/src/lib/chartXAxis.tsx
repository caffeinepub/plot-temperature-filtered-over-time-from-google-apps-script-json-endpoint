import type { ReactElement } from "react";

/** Month names (English) */
export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface XTickEntry {
  timestamp: number; // unix ms
  isDate: boolean; // true = midnight boundary (date label)
}

/**
 * Build the list of ticks for the visible window.
 * - One "date" tick at each exact midnight (00:00:00) boundary — always included.
 * - "Hour" ticks at regular intervals depending on the window size:
 *   - <= 2 days: every hour
 *   - <= 5 days: every 2 hours
 *   - <= 10 days: every 4 hours
 *   - <= 19 days: every 6 hours
 * Virtual ticks are inserted even if no data point falls on them exactly.
 * Midnight ticks are always included even if they fall before the first data point.
 * interval={0} must be set on XAxis so Recharts never drops ticks.
 */
export function buildXTicks(firstTs: number, lastTs: number): XTickEntry[] {
  const ticks: XTickEntry[] = [];
  const windowDays = (lastTs - firstTs) / 86400000;

  // Determine hour step for non-midnight ticks
  let hourStep = 1;
  if (windowDays > 10) hourStep = 6;
  else if (windowDays > 5) hourStep = 4;
  else if (windowDays > 2) hourStep = 2;

  // Walk from midnight of the first day, step = 1 hour
  // We start from midnight even if it's before firstTs so that day labels always appear
  const firstDate = new Date(firstTs);
  firstDate.setHours(0, 0, 0, 0);
  let cursor = firstDate.getTime();

  while (cursor <= lastTs) {
    const d = new Date(cursor);
    const isMidnight =
      d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0;

    if (isMidnight) {
      // Always include midnight ticks (day boundaries)
      ticks.push({ timestamp: cursor, isDate: true });
    } else if (cursor >= firstTs) {
      // Only include hour ticks within the visible window and at the right step
      const hour = d.getHours();
      if (hour % hourStep === 0) {
        ticks.push({ timestamp: cursor, isDate: false });
      }
    }
    cursor += 3600000; // +1 hour
  }

  return ticks;
}

/**
 * Compute the X-axis domain.
 * Uses the actual firstTs as the start (no midnight snap) to prevent empty space
 * when zoomed in. Day boundary ticks are shown via virtual ticks with allowDataOverflow.
 */
export function computeXDomain(
  firstTs: number,
  lastTs: number,
): [number, number] {
  return [firstTs, lastTs];
}

/**
 * Custom X-axis tick renderer.
 * Date ticks: larger, bold text (e.g. "18 February").
 * Hour ticks: small grey text (e.g. "14").
 */
export function CustomXTick(props: {
  x?: number;
  y?: number;
  payload?: { value: number };
  allTicks?: XTickEntry[];
  fill?: string;
}): ReactElement | null {
  const { x = 0, y = 0, payload, allTicks = [], fill = "#888" } = props;
  if (!payload) return null;
  const ts = payload.value;
  const entry = allTicks.find((t) => t.timestamp === ts);
  if (!entry) return null;

  const d = new Date(ts);
  if (entry.isDate) {
    const day = d.getDate().toString().padStart(2, "0");
    const month = (d.getMonth() + 1).toString().padStart(2, "0");
    return (
      <g transform={`translate(${x},${y})`}>
        <line x1={0} y1={0} x2={0} y2={14} stroke={fill} strokeWidth={2} />
        <text
          x={0}
          y={26}
          textAnchor="middle"
          fill={fill}
          fontSize={12}
          fontWeight="bold"
        >
          {`${day}/${month}`}
        </text>
      </g>
    );
  }

  // Hour tick
  const hour = d.getHours().toString().padStart(2, "0");
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1={0} y1={0} x2={0} y2={5} stroke="#999" strokeWidth={1} />
      <text
        x={0}
        y={15}
        textAnchor="middle"
        fill="#999"
        fontSize={9}
        opacity={0.8}
      >
        {hour}
      </text>
    </g>
  );
}
