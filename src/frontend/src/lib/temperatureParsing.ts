export interface TemperatureDataPoint {
  timestamp: Date;
  temperatureFiltered: number;
  temperatureCSV: number;
  co2Right: number;
  co2Left: number;
  co2CSV: number;
}

interface RawDataPoint {
  Timestamp: string;
  'Temperature Filtered(F)': string | number;
  'Temperature CSV(F)': string | number;
  'CO2 Rechts': string | number;
  'CO2 Links': string | number;
  'CO2 CSV(%)': string | number;
  [key: string]: unknown;
}

/**
 * Parses a numeric value that may be a number or string with comma as decimal separator
 * Examples: "71,86" -> 71.86, "71.86" -> 71.86, 71.86 -> 71.86
 */
function parseNumericValue(value: string | number): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  // If already a number, return it
  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  // If string, normalize and parse
  if (typeof value === 'string') {
    const normalized = value.trim().replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Parses a timestamp string in DD/MM/YY HH:mm:ss format or ISO format
 * Examples: "10/02/26 10:42:57" -> Date, "2026-02-10T10:42:57Z" -> Date
 */
function parseTimestamp(value: string): Date | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  // Try DD/MM/YY HH:mm:ss format first
  const ddmmyyPattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/;
  const match = value.match(ddmmyyPattern);
  
  if (match) {
    const [, day, month, year, hour, minute, second] = match;
    // Assume 20xx for year
    const fullYear = 2000 + parseInt(year, 10);
    const date = new Date(
      fullYear,
      parseInt(month, 10) - 1, // months are 0-indexed
      parseInt(day, 10),
      parseInt(hour, 10),
      parseInt(minute, 10),
      parseInt(second, 10)
    );
    return isNaN(date.getTime()) ? null : date;
  }

  // Fallback to ISO format parsing
  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Parses raw temperature and CO2 data from the API and filters out invalid points
 */
export function parseTemperatureData(rawData: RawDataPoint[]): TemperatureDataPoint[] {
  const validPoints: TemperatureDataPoint[] = [];

  for (const point of rawData) {
    const timestamp = parseTimestamp(point.Timestamp);
    const temperatureFiltered = parseNumericValue(point['Temperature Filtered(F)']);
    const temperatureCSV = parseNumericValue(point['Temperature CSV(F)']);
    const co2RightRaw = parseNumericValue(point['CO2 Rechts']);
    const co2LeftRaw = parseNumericValue(point['CO2 Links']);
    const co2CSV = parseNumericValue(point['CO2 CSV(%)']);

    // Convert CO2 Rechts and Links to percentage by multiplying by 0.001
    const co2Right = co2RightRaw !== null ? co2RightRaw * 0.001 : null;
    const co2Left = co2LeftRaw !== null ? co2LeftRaw * 0.001 : null;

    if (
      timestamp && 
      temperatureFiltered !== null && 
      temperatureCSV !== null &&
      co2Right !== null &&
      co2Left !== null &&
      co2CSV !== null
    ) {
      validPoints.push({
        timestamp,
        temperatureFiltered,
        temperatureCSV,
        co2Right,
        co2Left,
        co2CSV,
      });
    }
  }

  // Sort by timestamp to ensure chronological order
  validPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return validPoints;
}
