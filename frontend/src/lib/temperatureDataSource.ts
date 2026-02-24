import { parseTemperatureData } from './temperatureParsing';
import type { TemperatureDataPoint } from './temperatureParsing';

const DATA_URL = 'https://script.google.com/macros/s/AKfycbxnSb-bzTLWQmbHbo-ZBwxZn9444juSqzHjLokPZklrA86hXME_rt3NH8x1d-8xo8ZJoQ/exec';

interface RawDataPoint {
  Timestamp: string;
  'Temperature Filtered(F)': string | number;
  'Temperature CSV(F)': string | number;
  'CO2 Rechts': string | number;
  'CO2 Links': string | number;
  'CO2 CSV(%)': string | number;
  'Cooling(V)'?: string | number;
  'Heating(PWM)'?: string | number;
  'Ventilation(V)'?: string | number;
  'Fan 1(V)'?: string | number;
  'Fan 2(V)'?: string | number;
  'Fan 3(V)'?: string | number;
  'Stuursignaal debiet(Pa)'?: string | number;
  [key: string]: unknown;
}

export async function fetchTemperatureData(): Promise<TemperatureDataPoint[]> {
  try {
    const response = await fetch(DATA_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const rawData: RawDataPoint[] = await response.json();

    if (!Array.isArray(rawData)) {
      throw new Error('Invalid data format: expected an array');
    }

    const parsedData = parseTemperatureData(rawData);

    if (parsedData.length === 0) {
      throw new Error('No valid data points found in the response');
    }

    return parsedData;
  } catch (error) {
    console.error('Error fetching temperature data:', error);
    throw error instanceof Error ? error : new Error('Failed to fetch temperature data');
  }
}
