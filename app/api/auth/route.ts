import { NextRequest, NextResponse } from 'next/server';
import { APARTMENTS } from '@/lib/types';
import { getDefaultPassword } from '@/lib/utils';
import { saveApartmentSettings, getApartmentSettings } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { apartment, password, email } = await request.json();

    if (!apartment || !password) {
      return NextResponse.json({ error: 'Lejlighed og kodeord er påkrævet' }, { status: 400 });
    }

    if (!APARTMENTS.includes(apartment)) {
      return NextResponse.json({ error: 'Ugyldig lejlighed' }, { status: 400 });
    }

    if (password !== getDefaultPassword(apartment)) {
      return NextResponse.json({ error: 'Forkert kodeord' }, { status: 401 });
    }

    // Save/update settings with optional email
    if (email && email.includes('@')) {
      const existing = await getApartmentSettings(apartment) || { apartment };
      await saveApartmentSettings({ ...existing, apartment, email });
    }

    const token = Buffer.from(JSON.stringify({ apartment, timestamp: Date.now() })).toString('base64');

    return NextResponse.json({ success: true, apartment, token });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}
