export interface TemperatureDataPoint {
  timestamp: Date;
  temperatureFiltered: number;
  temperatureCSV: number;
}

interface RawDataPoint {
  Timestamp: string;
  'Temperature Filtered(F)': string | number;
  'Temperature CSV(F)': string | number;
  [key: string]: unknown;
}

/**
 * Parses a temperature value that may be a number or string with comma as decimal separator
 * Examples: "71,86" -> 71.86, "71.86" -> 71.86, 71.86 -> 71.86
 */
function parseTemperature(value: string | number): number | null {
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
 * Parses raw temperature data from the API and filters out invalid points
 */
export function parseTemperatureData(rawData: RawDataPoint[]): TemperatureDataPoint[] {
  const validPoints: TemperatureDataPoint[] = [];

  for (const point of rawData) {
    const timestamp = parseTimestamp(point.Timestamp);
    const temperatureFiltered = parseTemperature(point['Temperature Filtered(F)']);
    const temperatureCSV = parseTemperature(point['Temperature CSV(F)']);

    if (timestamp && temperatureFiltered !== null && temperatureCSV !== null) {
      validPoints.push({
        timestamp,
        temperatureFiltered,
        temperatureCSV,
      });
    }
  }

  // Sort by timestamp to ensure chronological order
  validPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return validPoints;
}
