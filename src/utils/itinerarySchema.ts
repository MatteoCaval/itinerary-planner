import { z } from 'zod';
import { DaySection, LocationCategory, TransportType } from '../types';

const daySectionSchema = z.enum(['morning', 'afternoon', 'evening'] as [DaySection, ...DaySection[]]);
const locationCategorySchema = z.enum(['sightseeing', 'dining', 'hotel', 'transit', 'other'] as [LocationCategory, ...LocationCategory[]]);
const transportTypeSchema = z.enum(['walk', 'car', 'bus', 'train', 'flight', 'ferry', 'other'] as [TransportType, ...TransportType[]]);

const checklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
  completed: z.boolean(),
}).passthrough();

const linkItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  url: z.string(),
}).passthrough();

const accommodationSchema = z.object({
  name: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  cost: z.union([z.number(), z.string()]).optional(),
  notes: z.string().optional(),
  link: z.string().optional(),
}).passthrough();

export const routeImportSchema = z.object({
  id: z.string(),
  fromLocationId: z.string(),
  toLocationId: z.string(),
  transportType: transportTypeSchema.optional(),
  duration: z.string().optional(),
  cost: z.union([z.number(), z.string()]).optional(),
  notes: z.string().optional(),
}).passthrough();

export type RouteImportData = z.infer<typeof routeImportSchema>;

export type LocationImportData = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  notes?: string;
  imageUrl?: string;
  dayIds?: string[];
  startDayId?: string;
  startSlot?: DaySection;
  duration?: number;
  order?: number;
  category?: LocationCategory;
  checklist?: z.infer<typeof checklistItemSchema>[];
  links?: z.infer<typeof linkItemSchema>[];
  cost?: number | string;
  targetTime?: string;
  dayOffset?: number;
  subLocations?: LocationImportData[];
};

const locationImportSchema: z.ZodType<LocationImportData> = z.lazy(() => z.object({
  id: z.string(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  notes: z.string().optional(),
  imageUrl: z.string().optional(),
  dayIds: z.array(z.string()).optional(),
  startDayId: z.string().optional(),
  startSlot: daySectionSchema.optional(),
  duration: z.number().optional(),
  order: z.number().optional(),
  category: locationCategorySchema.optional(),
  checklist: z.array(checklistItemSchema).optional(),
  links: z.array(linkItemSchema).optional(),
  cost: z.union([z.number(), z.string()]).optional(),
  targetTime: z.string().optional(),
  dayOffset: z.number().optional(),
  subLocations: z.array(locationImportSchema).optional(),
}).passthrough());

const dayImportSchema = z.object({
  id: z.string(),
  date: z.string(),
  label: z.string().optional(),
  accommodation: accommodationSchema.optional(),
}).passthrough();

export const itineraryImportSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  days: z.array(dayImportSchema).optional(),
  locations: z.array(locationImportSchema).optional(),
  routes: z.array(routeImportSchema).optional(),
  version: z.string().optional(),
}).passthrough();

export type ItineraryImportData = z.infer<typeof itineraryImportSchema>;
