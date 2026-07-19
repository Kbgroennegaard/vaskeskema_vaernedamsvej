import { NextRequest, NextResponse } from 'next/server';
import { getWeekData, getAllApartmentSettings, hasNotificationBeenSent, markNotificationSent } from '@/lib/db';
import { DAYS, DAY_LABELS, HOURS } from '@/lib/types';
import nodemailer from 'nodemailer';

export const dynamic = 'force-dynamic';

function getISOWeek(date: Date): number {
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

function getTodayDayIndex(): number {
  const day = new Date().getDay();
  return day === 0 ? 6 : day - 1;
}

function parseStartHour(hour: string): number {
  return parseInt(hour.split('-')[0]);
}

async function sendEmailNotification(email: string, apartment: string, dayLabel: string, hour: string) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `Vaskeskema AB Værnedamsvej 11 <${process.env.GMAIL_USER}>`,
    to: email,
    subject: `🧺 Reminder: Din vask starter om 30 min (${hour})`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #f0f4f8; border-radius: 12px;">
        <h2 style="color: #2C5F8D; margin-bottom: 8px;">🧺 Vaskeskema – AB Værnedamsvej 11</h2>
        <p style="color: #4A5F73; font-size: 16px;">Hej Lejl. <strong>${apartment}</strong>!</p>
        <div style="background: #D6E8F5; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="color: #2C5F8D; font-size: 18px; font-weight: bold; margin: 0;">
            Din vask starter om 30 minutter
          </p>
          <p style="color: #4A5F73; margin: 8px 0 0;">
            📅 ${dayLabel} kl. ${hour.replace('-', ':00–')}:00
          </p>
        </div>
        <p style="color: #7A8A99; font-size: 13px;">
          Husk at afbooke hvis du alligevel ikke kan bruge tiden.
        </p>
      </div>
    `,
  });
}

export async function GET(request: NextRequest) {
  try {
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const todayIndex = getTodayDayIndex();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const targetHour = currentMinute >= 25 ? currentHour + 1 : null;
    if (targetHour === null) {
      return NextResponse.json({ message: 'Not in notification window', sent: 0 });
    }

    const targetSlot = HOURS.find(h => parseStartHour(h) === targetHour);
    if (!targetSlot) {
      return NextResponse.json({ message: 'No slot at this hour', sent: 0 });
    }

    const todayDay = DAYS[todayIndex];
    const todayLabel = DAY_LABELS[todayIndex];

    const weekData = await getWeekData(currentWeek);
    const bookingKey = `${todayDay}|${targetSlot}`;
    const bookedApartment = weekData[bookingKey];

    if (!bookedApartment) {
      return NextResponse.json({ message: 'No booking at target time', sent: 0 });
    }

    const alreadySent = await hasNotificationBeenSent(bookedApartment, currentWeek, todayDay, targetSlot);
    if (alreadySent) {
      return NextResponse.json({ message: 'Already notified', sent: 0 });
    }

    const allSettings = await getAllApartmentSettings();
    const aptSettings = allSettings.find(s => s.apartment === bookedApartment);

    let sent = 0;

    if (aptSettings?.email && process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
      try {
        await sendEmailNotification(aptSettings.email, bookedApartment, todayLabel, targetSlot);
        sent++;
      } catch (e) {
        console.error('Email failed:', e);
      }
    }

    if (sent > 0) {
      await markNotificationSent(bookedApartment, currentWeek, todayDay, targetSlot);
    }

    return NextResponse.json({ message: `Notifications sent for ${bookedApartment}`, sent });

  } catch (error) {
    console.error('Notify error:', error);
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}
