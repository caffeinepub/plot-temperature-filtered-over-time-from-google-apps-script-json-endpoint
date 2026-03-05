export interface TSICDataPoint {
  timestamp: Date;
  sensors: {
    S1: number;
    S2: number;
    S3: number;
    S4: number;
    S5: number;
    S6: number;
    S7: number;
    S8: number;
    S9: number;
    S10: number;
    S11: number;
    S12: number;
    S13: number;
    S14: number;
    S15: number;
    S16: number;
    S17: number;
    S18: number;
    S19: number;
    S20: number;
    S21: number;
    S22: number;
    S23: number;
    S24: number;
    S25: number;
    S26: number;
    S27: number;
    S28: number;
    S29: number;
    S30: number;
    S31: number;
    S32: number;
    S33: number;
    S34: number;
    S35: number;
    S36: number;
    S37: number;
    S38: number;
    S39: number;
    S40: number;
    S41: number;
    S42: number;
    S43: number;
    S44: number;
    S45: number;
    S46: number;
    S47: number;
    S48: number;
    S49: number;
    S50: number;
    S51: number;
    S52: number;
    S53: number;
    S54: number;
    S55: number;
    S56: number;
    S57: number;
    S58: number;
    S59: number;
    S60: number;
    S61: number;
    S62: number;
    S63: number;
    S64: number;
    S65: number;
    S66: number;
    S67: number;
    S68: number;
    S69: number;
    S70: number;
    S71: number;
    S72: number;
  };
}

interface RawTSICDataPoint {
  Timestamp: string;
  [key: string]: unknown;
}

function parseTimestamp(timestampStr: string): Date | null {
  try {
    // Try parsing ISO format first
    const date = new Date(timestampStr);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
    return null;
  } catch {
    return null;
  }
}

function parseNumericValue(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function parseTSICData(rawData: RawTSICDataPoint[]): TSICDataPoint[] {
  const validPoints: TSICDataPoint[] = [];

  for (const raw of rawData) {
    // Parse timestamp
    const timestamp = parseTimestamp(raw.Timestamp);
    if (!timestamp) {
      continue; // Skip invalid timestamps
    }

    // Parse all 72 sensors
    const sensors: any = {};
    for (let i = 1; i <= 72; i++) {
      const sensorKey = `S${i}`;
      sensors[sensorKey] = parseNumericValue(raw[sensorKey]);
    }

    validPoints.push({
      timestamp,
      sensors,
    });
  }

  // Sort by timestamp
  validPoints.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  return validPoints;
}
