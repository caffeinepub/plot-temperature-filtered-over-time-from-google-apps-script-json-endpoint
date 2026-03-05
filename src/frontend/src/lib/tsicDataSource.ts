import { parseTSICData } from "./tsicDataParsing";
import type { TSICDataPoint } from "./tsicDataParsing";

const BASE_URL =
  "https://script.google.com/macros/s/AKfycbzdLbsbeJY5oRIQ-rgLJHciqrZCPxK4efH_Xuva7MuOlnXuPEQsk7ZtnRgSHumV47pu/exec";

interface RawTSICDataPoint {
  Timestamp: string;
  S1: string | number;
  S2: string | number;
  S3: string | number;
  S4: string | number;
  S5: string | number;
  S6: string | number;
  S7: string | number;
  S8: string | number;
  S9: string | number;
  S10: string | number;
  S11: string | number;
  S12: string | number;
  S13: string | number;
  S14: string | number;
  S15: string | number;
  S16: string | number;
  S17: string | number;
  S18: string | number;
  S19: string | number;
  S20: string | number;
  S21: string | number;
  S22: string | number;
  S23: string | number;
  S24: string | number;
  S25: string | number;
  S26: string | number;
  S27: string | number;
  S28: string | number;
  S29: string | number;
  S30: string | number;
  S31: string | number;
  S32: string | number;
  S33: string | number;
  S34: string | number;
  S35: string | number;
  S36: string | number;
  S37: string | number;
  S38: string | number;
  S39: string | number;
  S40: string | number;
  S41: string | number;
  S42: string | number;
  S43: string | number;
  S44: string | number;
  S45: string | number;
  S46: string | number;
  S47: string | number;
  S48: string | number;
  S49: string | number;
  S50: string | number;
  S51: string | number;
  S52: string | number;
  S53: string | number;
  S54: string | number;
  S55: string | number;
  S56: string | number;
  S57: string | number;
  S58: string | number;
  S59: string | number;
  S60: string | number;
  S61: string | number;
  S62: string | number;
  S63: string | number;
  S64: string | number;
  S65: string | number;
  S66: string | number;
  S67: string | number;
  S68: string | number;
  S69: string | number;
  S70: string | number;
  S71: string | number;
  S72: string | number;
  [key: string]: unknown;
}

export async function fetchTSICData(id: number): Promise<TSICDataPoint[]> {
  try {
    const url = `${BASE_URL}?id=${id}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData: RawTSICDataPoint[] = await response.json();

    if (!Array.isArray(rawData)) {
      throw new Error("Invalid data format: expected an array");
    }

    const parsedData = parseTSICData(rawData);

    if (parsedData.length === 0) {
      throw new Error("No valid data points found in the response");
    }

    return parsedData;
  } catch (error) {
    console.error("Error fetching TSIC data:", error);
    throw error instanceof Error
      ? error
      : new Error("Failed to fetch TSIC data");
  }
}
