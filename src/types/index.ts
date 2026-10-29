export interface SoilReading {
  timestamp?: string;
  time?: string;
  moisture: number;
  N: number;
  P: number;
  K: number;
  pH: number;
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  crop?: string;
  [key: string]: any;
}

export interface IdealRequirements {
  N?: number | null;
  P?: number | null;
  K?: number | null;
  pH?: number | null;
  moisture?: number | null;
  temperature?: number | null;
  humidity?: number | null;
  rainfall?: number | null;
}

export interface CropRequirementEntry {
  crop: string;
  source: string;
  ideal: IdealRequirements;
  stages?: Record<string, Partial<IdealRequirements>>;
}

export interface DosageNutrientDetail {
  current: number;
  ideal: number;
  deficit: number;
  dose_kg: number;
  commercial_fertilizer?: string;
  commercial_kg?: number;
}

export interface DosageWaterDetail {
  current_pct: number;
  ideal_pct: number;
  irrigation_mm: number;
  litres: number;
  pump_hours_5hp?: number;
}

export interface DosageResult {
  crop: string;
  stage: string | null;
  area_acres: number;
  dosage: {
    N?: DosageNutrientDetail;
    P?: DosageNutrientDetail;
    K?: DosageNutrientDetail;
    water?: DosageWaterDetail;
  };
  notes: string[];
  assumptions: string;
  requirements_source: string;
  error?: string;
}

export interface TrendResult {
  column: string;
  readings: number;
  slope_per_reading: number;
  min: number;
  max: number;
  latest: number;
  status: 'falling' | 'rising' | 'stable';
  error?: string;
}

export interface WeatherForecastResult {
  rain_probability_pct: number[];
  rain_mm: number[];
  days_ahead: number[];
  city?: string;
  coordinates?: { lat: number; lon: number };
  error?: string;
}

export interface SoilSummaryResult {
  rows: number;
  has_time_column: boolean;
  columns: string[];
  mean: Record<string, number>;
  latest: Record<string, number>;
  crops_in_data?: string[];
  error?: string;
}

export interface TraceStep {
  thought: string;
  tool: string;
  args: Record<string, any>;
  observation: string;
}

export interface AgentJudgesResponse {
  answer: string;
  trace: TraceStep[];
}

export type UrgencyLevel = 'GREEN' | 'YELLOW' | 'RED';

export interface ParsedAdvice {
  urgency: UrgencyLevel;
  englishAdvice: string;
  tamilAdvice: string;
  disclaimer: string;
  rawText: string;
}

declare global {
  const __GROQ_API_KEY__: string;
}
