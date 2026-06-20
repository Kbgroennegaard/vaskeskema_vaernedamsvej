import { Redis } from '@upstash/redis';
import { WeekData, ApartmentSettings, PushSubscriptionData } from './types';

const memoryStore = new Map<string, string>();

const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

let redis: Redis | null = null;
if (hasKV) {
  try {
    redis = new Redis({
      url: process.env.KV_REST_API_URL!,
      token: process.env.KV_REST_API_TOKEN!,
    });
  } catch (e) {
    console.error('Failed to initialize Upstash Redis, falling back to memory storage:', e);
  }
}

async function kvGet(key: string): Promise<any> {
  if (redis) return await redis.get(key);
  const data = memoryStore.get(key);
  return data ? JSON.parse(data) : null;
}

async function kvSet(key: string, value: any): Promise<void> {
  if (redis) { await redis.set(key, value); return; }
  memoryStore.set(key, JSON.stringify(value));
}

async function kvDelete(key: string): Promise<void> {
  if (redis) { await redis.del(key); return; }
  memoryStore.delete(key);
}

// Week bookings
export async function getWeekData(week: number): Promise<WeekData> {
  return (await kvGet(`week:${week}`)) || {};
}

export async function setWeekData(week: number, data: WeekData): Promise<void> {
  await kvSet(`week:${week}`, data);
}

export async function addBooking(week: number, day: string, hour: string, apartment: string): Promise<void> {
  const data = await getWeekData(week);
  data[`${day}|${hour}`] = apartment;
  await setWeekData(week, data);
}

export async function removeBooking(week: number, day: string, hour: string): Promise<void> {
  const data = await getWeekData(week);
  delete data[`${day}|${hour}`];
  await setWeekData(week, data);
}

export async function getBooking(week: number, day: string, hour: string): Promise<string | null> {
  const data = await getWeekData(week);
  return data[`${day}|${hour}`] || null;
}

export async function countBookingsForDay(week: number, apartment: string, day: string): Promise<number> {
  const data = await getWeekData(week);
  return Object.entries(data).filter(([key, apt]) => key.startsWith(`${day}|`) && apt === apartment).length;
}

// Apartment settings (email + push subscription)
export async function getApartmentSettings(apartment: string): Promise<ApartmentSettings | null> {
  return await kvGet(`settings:${apartment.replace(/\./g, '').replace(/ /g, '')}`);
}

export async function saveApartmentSettings(settings: ApartmentSettings): Promise<void> {
  const key = `settings:${settings.apartment.replace(/\./g, '').replace(/ /g, '')}`;
  await kvSet(key, settings);
}

export async function savePushSubscription(apartment: string, subscription: PushSubscriptionData): Promise<void> {
  const existing = await getApartmentSettings(apartment) || { apartment };
  await saveApartmentSettings({ ...existing, pushSubscription: subscription });
}

export async function saveEmail(apartment: string, email: string): Promise<void> {
  const existing = await getApartmentSettings(apartment) || { apartment };
  await saveApartmentSettings({ ...existing, email });
}

export async function getAllApartmentSettings(): Promise<ApartmentSettings[]> {
  const { APARTMENTS } = require('./types');
  const results: ApartmentSettings[] = [];
  for (const apt of APARTMENTS) {
    const settings = await getApartmentSettings(apt);
    if (settings) results.push(settings);
  }
  return results;
}

// Track sent notifications to avoid duplicates
export async function hasNotificationBeenSent(apartment: string, week: number, day: string, hour: string): Promise<boolean> {
  const key = `notified:${apartment.replace(/\./g, '').replace(/ /g, '')}:${week}:${day}:${hour}`;
  return !!(await kvGet(key));
}

export async function markNotificationSent(apartment: string, week: number, day: string, hour: string): Promise<void> {
  const key = `notified:${apartment.replace(/\./g, '').replace(/ /g, '')}:${week}:${day}:${hour}`;
  await kvSet(key, '1');
}
