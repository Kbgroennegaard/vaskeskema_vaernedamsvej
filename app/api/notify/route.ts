import { NextRequest, NextResponse } from 'next/server';
import { getWeekData, getAllApartmentSettings, hasNotificationBeenSent, markNotificationSent } from '@/lib/db';
import { DAYS, DAY_LABELS, HOURS } from '@/lib/types';

// Get ISO week number
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

// Get day index for today (0=man, 1=tir, etc.)
function getTodayDayIndex(): number {
  const day = new Date().getDay(); // 0=sun, 1=mon...
  return day === 0 ? 6 : day - 1;
}

// Parse hour string to start hour number
function parseStartHour(hour: string): number {
  return parseInt(hour.split('-')[0]);
}

async function sendPushNotification(subscription: any, title: string, body: string) {
  const webpush = require('web-push');

  webpush.setVapidDetails(
    'mailto:' + (process.env.VAPID_EMAIL || 'vaskeskema@example.com'),
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  await webpush.sendNotification(subscription, JSON.stringify({ title, body, tag: 'reminder' }));
}

async function sendEmailNotification(email: string, apartment: string, dayLabel: string, hour: string) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  await resend.emails.send({
    from: 'Vaskeskema <noreply@vaskeskema.dk>',
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
          Husk at afbooke hvis du alligevel ikke kan bruge tiden, så andre kan benytte den.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://vaskeskema-vaernedamsvej.vercel.app'}" 
           style="display: inline-block; background: #2C5F8D; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px; margin-top: 8px;">
          Åbn vaskeskema
        </a>
      </div>
    `
  });
}

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const currentWeek = getISOWeek(now);
    const todayIndex = getTodayDayIndex();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    // Find which hour slot starts in ~30 minutes
    // e.g. if it's 09:28, notify about 10:00 slot
    const targetHour = currentMinute >= 25 ? currentHour + 1 : null;
    if (targetHour === null) {
      return NextResponse.json({ message: 'Not in notification window', sent: 0 });
    }

    // Find matching hour slot
    const targetSlot = HOURS.find(h => parseStartHour(h) === targetHour);
    if (!targetSlot) {
      return NextResponse.json({ message: 'No slot at this hour', sent: 0 });
    }

    const todayDay = DAYS[todayIndex];
    const todayLabel = DAY_LABELS[todayIndex];

    // Get bookings for current week
    const weekData = await getWeekData(currentWeek);
    const bookingKey = `${todayDay}|${targetSlot}`;
    const bookedApartment = weekData[bookingKey];

    if (!bookedApartment) {
      return NextResponse.json({ message: 'No booking at target time', sent: 0 });
    }

    // Check if already notified
    const alreadySent = await hasNotificationBeenSent(bookedApartment, currentWeek, todayDay, targetSlot);
    if (alreadySent) {
      return NextResponse.json({ message: 'Already notified', sent: 0 });
    }

    // Get apartment settings
    const allSettings = await getAllApartmentSettings();
    const aptSettings = allSettings.find(s => s.apartment === bookedApartment);

    let sent = 0;

    if (aptSettings) {
      // Send push notification
      if (aptSettings.pushSubscription && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        try {
          await sendPushNotification(
            aptSettings.pushSubscription,
            '🧺 Vask starter om 30 min!',
            `Din booking kl. ${targetSlot.replace('-', ':00–')}:00 starter snart`
          );
          sent++;
        } catch (e) {
          console.error('Push failed:', e);
        }
      }

      // Send email
      if (aptSettings.email && process.env.RESEND_API_KEY) {
        try {
          await sendEmailNotification(aptSettings.email, bookedApartment, todayLabel, targetSlot);
          sent++;
        } catch (e) {
          console.error('Email failed:', e);
        }
      }
    }

    // Mark as sent
    if (sent > 0) {
      await markNotificationSent(bookedApartment, currentWeek, todayDay, targetSlot);
    }

    return NextResponse.json({
      message: `Notifications sent for ${bookedApartment}`,
      sent,
      slot: targetSlot,
      day: todayLabel
    });

  } catch (error) {
    console.error('Notify cron error:', error);
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}
