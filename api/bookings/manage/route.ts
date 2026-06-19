import { NextRequest, NextResponse } from 'next/server';
import { addBooking, removeBooking, getBooking, countBookingsForDay } from '@/lib/db';
import { DAYS, HOURS, MAX_BOOKINGS_PER_DAY } from '@/lib/types';

function verifyToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    return decoded.apartment;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const apartment = verifyToken(token);
    if (!apartment) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });

    const { week, day, hour } = await request.json();
    if (!week || !day || !hour) return NextResponse.json({ error: 'Manglende parametre' }, { status: 400 });
    if (!DAYS.includes(day) || !HOURS.includes(hour)) return NextResponse.json({ error: 'Ugyldig dag eller tid' }, { status: 400 });

    const existing = await getBooking(week, day, hour);
    if (existing) return NextResponse.json({ error: 'Tidspunkt er allerede booket' }, { status: 409 });

    const count = await countBookingsForDay(week, apartment, day);
    if (count >= MAX_BOOKINGS_PER_DAY) return NextResponse.json({ error: `Max ${MAX_BOOKINGS_PER_DAY} moduler pr. dag nået` }, { status: 400 });

    await addBooking(week, day, hour, apartment);

    return NextResponse.json({ success: true, booking: { week, day, hour, apartment } });
  } catch (error) {
    console.error('Create booking error:', error);
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const apartment = verifyToken(token);
    if (!apartment) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '0');
    const day = searchParams.get('day');
    const hour = searchParams.get('hour');
    if (!week || !day || !hour) return NextResponse.json({ error: 'Manglende parametre' }, { status: 400 });

    const existing = await getBooking(week, day, hour);
    if (!existing) return NextResponse.json({ error: 'Booking findes ikke' }, { status: 404 });
    if (existing !== apartment) return NextResponse.json({ error: 'Kan kun slette egne bookinger' }, { status: 403 });

    await removeBooking(week, day, hour);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete booking error:', error);
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}
