import { NextRequest, NextResponse } from 'next/server';
import { getWeekData } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '0');

    if (!week || week < 1 || week > 52) {
      return NextResponse.json({ error: 'Ugyldigt ugenummer' }, { status: 400 });
    }

    const data = await getWeekData(week);
    return NextResponse.json({ week, bookings: data });
  } catch (error) {
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}
