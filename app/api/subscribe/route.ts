import { NextRequest, NextResponse } from 'next/server';
import { savePushSubscription } from '@/lib/db';

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

    const { subscription } = await request.json();

    if (!subscription?.endpoint || !subscription?.keys) {
      return NextResponse.json({ error: 'Ugyldig subscription' }, { status: 400 });
    }

    await savePushSubscription(apartment, subscription);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Server fejl' }, { status: 500 });
  }
}
