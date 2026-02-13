import { DaySection } from '../types';

export const SECTION_ORDER: DaySection[] = ['morning', 'afternoon', 'evening'];

export const getSectionIndex = (section?: DaySection): number => {
  if (!section) return 0;
  return SECTION_ORDER.indexOf(section);
};

export const DEFAULT_SECTION: DaySection = 'morning';
export const DEFAULT_CATEGORY = 'sightseeing' as const;
export const DEFAULT_AI_MODEL = 'gemini-3-flash-preview';
export const UNASSIGNED_ZONE_ID = 'unassigned-zone';
export const SLOT_PREFIX = 'slot-';
