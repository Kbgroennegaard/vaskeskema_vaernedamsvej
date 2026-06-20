export function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function getCurrentWeek(): number {
  return getISOWeek(new Date());
}

export function getWeekDates(weekNum: number, year: number = new Date().getFullYear()): Date[] {
  const jan1 = new Date(year, 0, 1);
  const daysToAdd = (weekNum - 1) * 7;
  const firstDay = new Date(jan1.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
  const dayOfWeek = firstDay.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(firstDay.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    dates.push(new Date(monday.getTime() + i * 24 * 60 * 60 * 1000));
  }
  return dates;
}

export function isDateInPast(date: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate < now;
}

export function getDefaultPassword(apartment: string): string {
  return `${apartment.replace(/\./g, '').replace(/ /g, '')}-vask`;
}
