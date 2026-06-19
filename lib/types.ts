export interface Booking {
  week: number;
  day: string;
  hour: string;
  apartment: string;
}

export interface WeekData {
  [key: string]: string;
}

export interface UserSession {
  apartment: string;
  authenticated: boolean;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface ApartmentSettings {
  apartment: string;
  email?: string;
  pushSubscription?: PushSubscriptionData;
}

export const APARTMENTS = [
  '1.th', '1.tv',
  '2.th', '2.tv',
  '3.th', '3.tv',
  '4.th', '4.tv',
  '5. sal'
];

export const HOURS = [
  '07-08', '08-09', '09-10', '10-11',
  '11-12', '12-13', '13-14', '14-15',
  '15-16', '16-17', '17-18', '18-19',
  '19-20', '20-21', '21-22', '22-23'
];

export const DAYS = ['man', 'tir', 'ons', 'tor', 'fre', 'lor', 'son'];
export const DAY_LABELS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag'];
export const MONTH_NAMES = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

export const MAX_BOOKINGS_PER_DAY = 3;
