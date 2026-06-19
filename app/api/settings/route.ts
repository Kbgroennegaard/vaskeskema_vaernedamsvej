import { NextRequest, NextResponse } from 'next/server';
import { saveEmail, getApartmentSettings } from '@/lib/db';

function verifyToken(token: string | null): string | null {
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

    if (!apartment) {
      return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });
    }

    const { email } = await request.json();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Ugyldig email' }, { status: 400 });
    }

    await saveEmail(apartment, email);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings error:', error);
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    const apartment = verifyToken(token);
    if (!apartment) return NextResponse.json({ error: 'Ikke autoriseret' }, { status: 401 });

    const settings = await getApartmentSettings(apartment);
    return NextResponse.json({ email: settings?.email || '', hasPush: !!settings?.pushSubscription });
  } catch (error) {
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}
