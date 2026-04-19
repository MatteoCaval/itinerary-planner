import { Sunrise, Sun, Moon, type LucideIcon } from 'lucide-react';

export type PeriodKey = 'morning' | 'afternoon' | 'evening';

const META: Record<PeriodKey, { icon: LucideIcon; label: string }> = {
  morning: { icon: Sunrise, label: 'Morning' },
  afternoon: { icon: Sun, label: 'Afternoon' },
  evening: { icon: Moon, label: 'Evening' },
};

export const getPeriodIcon = (p: PeriodKey): LucideIcon => META[p].icon;
export const getPeriodLabel = (p: PeriodKey): string => META[p].label;
