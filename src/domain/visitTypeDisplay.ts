import type { VisitType } from './types';

/** Returns a Tailwind background class for a visit type. */
export function getVisitTypeBg(type: VisitType) {
  switch (type) {
    case 'landmark': return 'bg-primary';
    case 'museum':   return 'bg-blue-400';
    case 'food':     return 'bg-emerald-400';
    case 'walk':     return 'bg-teal-400';
    case 'shopping': return 'bg-violet-400';
    default:         return 'bg-slate-400';
  }
}

/** Returns Tailwind color/bg/border classes for a visit type badge. */
export function getVisitTypeColor(type: VisitType) {
  switch (type) {
    case 'landmark': return 'text-primary bg-primary/10 border-primary/20';
    case 'museum':   return 'text-blue-600 bg-blue-50 border-blue-200';
    case 'food':     return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'walk':     return 'text-teal-600 bg-teal-50 border-teal-200';
    case 'shopping': return 'text-violet-600 bg-violet-50 border-violet-200';
    default:         return 'text-slate-500 bg-slate-50 border-slate-200';
  }
}

/** Returns a human-readable label for a visit type. */
export function getVisitLabel(type: VisitType) {
  switch (type) {
    case 'landmark': return 'Sight';
    case 'museum':   return 'Culture';
    case 'food':     return 'Food';
    case 'walk':     return 'Nature';
    case 'shopping': return 'Shopping';
    default:         return 'Place';
  }
}
