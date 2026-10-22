export const EVENT_TYPES = ['MOOD_SELECTED', 'STORE_VISITED', 'PRODUCT_VIEWED', 'PRODUCT_SAVED', 'RECOMMENDATION_IMPRESSION',
  'RECOMMENDATION_CLICKED', 'EXTERNAL_ROUTE_CLICKED', 'PINCODE_UPDATED', 'FLOOR_CHANGED', 'MAP_OPENED', 'EASTER_EGG_FOUND'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export type Prop = string | number | boolean;
export interface TelemetryEvent { eventId: string; eventType: EventType; timestamp: number; properties: Record<string, Prop> }
