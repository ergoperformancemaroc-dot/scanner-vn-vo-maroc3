
export type BusinessType = 'VN' | 'VO';

export interface AppSettings {
  companyName: string;
  allowedLocations: string[];
  strictLocationMode: boolean;
  businessType: BusinessType;
}

export interface VehicleInfo {
  vin: string;
  plate?: string;
  make: string;
  model: string;
  year: string;
  timestamp: string;
  fullDate: string;
  location: string;
  remarks?: string;
}

export type ScanType = 'vin' | 'carte_grise';

export interface GeminiResponse {
  vin?: string;
  plate?: string;
  make?: string;
  model?: string;
  year?: string;
  error?: string;
}
