import type { ActivityLevel, Sex } from './types.js';

/**
 * Starting-point estimate ONLY. Mifflin-St Jeor BMR × activity multiplier.
 * Population equations commonly miss individuals by ±10% or more; the weekly
 * weight trend is what should drive changes, not this number.
 */
export const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  very_high: 1.9,
};

export const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary (desk, little walking)',
  light: 'Light (training 1–3×/wk)',
  moderate: 'Moderate (training 3–5×/wk)',
  high: 'High (training 6–7×/wk or active job)',
  very_high: 'Very high (hard training + physical job)',
};

export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: Sex): number | null {
  if (sex === 'unspecified') return null;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(sex === 'male' ? base + 5 : base - 161);
}

export function estimateMaintenance(weightKg: number, heightCm: number, age: number, sex: Sex, activity: ActivityLevel): number | null {
  const bmr = bmrMifflin(weightKg, heightCm, age, sex);
  return bmr === null ? null : Math.round((bmr * ACTIVITY_MULTIPLIER[activity]) / 10) * 10;
}
