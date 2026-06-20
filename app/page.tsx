'use client';

import { useState, useEffect, useCallback } from 'react';
import { APARTMENTS, HOURS, DAYS, DAY_LABELS, MONTH_NAMES, MAX_BOOKINGS_PER_DAY } from '@/lib/types';
import { getCurrentWeek, getWeekDates, isDateInPast } from '@/lib/utils';
import styles from './page.module.css';

interface WeekData { [key: string]: string; }

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apartment, setApartment] = useState('');
  const [token, setToken] = useState('');
  const [selectedApartment, setSelectedApartment] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentWeek, setCurrentWeek] = useState(getCurrentWeek());
  const [bookings, setBookings] = useState<WeekData>({});
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Klik på et tidsrum for at booke');
  const [statusType, setStatusType] = useState<'info'|'success'|'error'|'warning'>('info');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');
  const [settingsEmail, setSettingsEmail] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('vaskeskema_token');
    const savedApt = localStorage.getItem('vaskeskema_apartment');
    if (savedToken && savedApt) {
      setToken(savedToken);
      setApartment(savedApt);
      setIsAuthenticated(true);
    }
  }, []);

  const fetchSettings = useCallback(async (tok: string) => {
    try {
      const res = await fetch('/api/settings', { headers: { 'Authorization': `Bearer ${tok}` }, cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSavedEmail(data.email || '');
        setSettingsEmail(data.email || '');
        setPushEnabled(data.hasPush || false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      fetchBookings();
      fetchSettings(token);
      registerServiceWorker();
    }
  }, [currentWeek, isAuthenticated]);

  const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    try {
      await navigator.serviceWorker.register('/sw.js');
    } catch (e) {
      console.error('SW registration failed:', e);
    }
  };

  const enablePushNotifications = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      alert('Din browser understøtter ikke push-notifikationer. Prøv Chrome eller Safari.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        alert('Du skal tillade notifikationer for at modtage reminders.');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) { alert('Push notifikationer er ikke konfigureret endnu.'); return; }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey)
      });

      await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ subscription })
      });

      setPushEnabled(true);
      setStatusMessage('Push-notifikationer aktiveret! ✅');
      setStatusType('success');
    } catch (e) {
      console.error('Push subscription failed:', e);
      setStatusMessage('Kunne ikke aktivere push-notifikationer');
      setStatusType('error');
    }
  };

  const saveSettings = async () => {
    if (!settingsEmail || !settingsEmail.includes('@')) {
      alert('Indtast en gyldig email-adresse');
      return;
    }
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ email: settingsEmail })
      });
      if (res.ok) {
        setSavedEmail(settingsEmail);
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 3000);
      }
    } catch {}
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apartment: selectedApartment, password }),
      });
      const data = await res.json();
      if (!res.ok) { setLoginError(data.error || 'Login fejlede'); setIsLoggingIn(false); return; }

      localStorage.setItem('vaskeskema_token', data.token);
      localStorage.setItem('vaskeskema_apartment', data.apartment);
      setToken(data.token);
      setApartment(data.apartment);
      setIsAuthenticated(true);
      setIsLoggingIn(false);

      // Save email if provided
      if (email && email.includes('@')) {
        await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${data.token}` },
          body: JSON.stringify({ email })
        });
        setSavedEmail(email);
        setSettingsEmail(email);
      }
    } catch { setLoginError('Netværksfejl - prøv igen'); setIsLoggingIn(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem('vaskeskema_token');
    localStorage.removeItem('vaskeskema_apartment');
    setIsAuthenticated(false); setToken(''); setApartment('');
    setShowSettings(false);
    setCurrentWeek(getCurrentWeek());
  };

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/bookings?week=${currentWeek}`, { cache: 'no-store' });
      const data = await res.json();
      if (res.ok) setBookings(data.bookings || {});
    } catch {}
    setIsLoading(false);
  };

  const handleSlotClick = async (day: string, hour: string, dayIndex: number) => {
    const dates = getWeekDates(currentWeek);
    if (isDateInPast(dates[dayIndex])) {
      setStatusMessage('Kan ikke ændre bookinger i fortiden'); setStatusType('warning'); return;
    }
    const key = `${day}|${hour}`;
    const existing = bookings[key];
    if (existing === apartment) { await removeBooking(day, hour); return; }
    if (existing) { setStatusMessage(`Booket af ${existing}`); setStatusType('warning'); return; }
    await createBooking(day, hour);
  };

  const createBooking = async (day: string, hour: string) => {
    try {
      const res = await fetch('/api/bookings/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ week: currentWeek, day, hour }),
      });
      const data = await res.json();
      if (!res.ok) { setStatusMessage(data.error || 'Booking fejlede'); setStatusType('error'); return; }
      const key = `${day}|${hour}`;
      const newBookings = { ...bookings, [key]: apartment };
      setBookings(newBookings);
      const count = countBookingsForDay(apartment, day, newBookings);
      setStatusMessage(`Booket: ${DAY_LABELS[DAYS.indexOf(day)]} ${hour} (${count}/${MAX_BOOKINGS_PER_DAY} i dag)`);
      setStatusType('success');
    } catch { setStatusMessage('Netværksfejl - prøv igen'); setStatusType('error'); }
  };

  const removeBooking = async (day: string, hour: string) => {
    try {
      const res = await fetch(`/api/bookings/manage?week=${currentWeek}&day=${day}&hour=${hour}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { setStatusMessage(data.error || 'Sletning fejlede'); setStatusType('error'); return; }
      const key = `${day}|${hour}`;
      const newBookings = { ...bookings };
      delete newBookings[key];
      setBookings(newBookings);
      setStatusMessage(`Booking fjernet (${DAY_LABELS[DAYS.indexOf(day)]} ${hour})`);
      setStatusType('info');
    } catch { setStatusMessage('Netværksfejl - prøv igen'); setStatusType('error'); }
  };

  const countBookingsForDay = (apt: string, day: string, bk: WeekData = bookings): number =>
    HOURS.filter(h => bk[`${day}|${h}`] === apt).length;

  const getTodayCount = (): number => {
    const dates = getWeekDates(currentWeek);
    const today = new Date();
    for (let i = 0; i < dates.length; i++) {
      if (dates[i].toDateString() === today.toDateString()) return countBookingsForDay(apartment, DAYS[i]);
    }
    return 0;
  };

  if (!isAuthenticated) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h1 className={styles.loginTitle}>🧺 Vaskeskema</h1>
          <p className={styles.loginSubtitle}>AB Værnedamsvej 11</p>
          <form onSubmit={handleLogin} className={styles.loginForm}>
            <label>Din lejlighed:</label>
            <select value={selectedApartment} onChange={e => setSelectedApartment(e.target.value)} required>
              <option value="">-- Vælg lejlighed --</option>
              {APARTMENTS.map(apt => <option key={apt} value={apt}>Lejl. {apt}</option>)}
            </select>
            <label>Kodeord:</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="fx 2th-vask" required />
            <label>Email til reminders: <span className={styles.optional}>(valgfrit)</span></label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="din@email.dk" />
            {loginError && <div className={styles.loginError}>{loginError}</div>}
            <button type="submit" disabled={isLoggingIn}>{isLoggingIn ? 'Logger ind...' : 'Log ind'}</button>
          </form>
          <div className={styles.loginNote}>
            Kodeord: <code>[lejlighed]-vask</code> — fx <code>2th-vask</code>
          </div>
        </div>
      </div>
    );
  }

  const dates = getWeekDates(currentWeek);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <h1>Vaskeskema — AB Værnedamsvej 11</h1>
          <div className={styles.loggedInAs}>Logget ind som: Lejl. {apartment}</div>
        </div>
        <div className={styles.headerActions}>
          <div className={styles.weekNav}>
            <button onClick={() => setCurrentWeek(w => Math.max(1, w-1))} disabled={currentWeek <= 1}>‹</button>
            <div className={styles.weekDisplay}>Uge {currentWeek}</div>
            <button onClick={() => setCurrentWeek(w => Math.min(52, w+1))} disabled={currentWeek >= 52}>›</button>
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className={styles.settingsBtn} title="Indstillinger">⚙️</button>
          <button onClick={handleLogout} className={styles.logoutBtn}>Log ud</button>
        </div>
      </header>

      {showSettings && (
        <div className={styles.settingsPanel}>
          <h3>Notifikationer</h3>
          <p className={styles.settingsDesc}>Modtag en reminder 30 minutter før din bookede vasketid.</p>

          <div className={styles.settingsRow}>
            <label>Email-reminder:</label>
            <div className={styles.settingsInputRow}>
              <input type="email" value={settingsEmail} onChange={e => setSettingsEmail(e.target.value)} placeholder="din@email.dk" />
              <button onClick={saveSettings} className={styles.saveBtn}>{settingsSaved ? '✅ Gemt!' : 'Gem'}</button>
            </div>
            {savedEmail && <span className={styles.settingsSaved}>Nuværende: {savedEmail}</span>}
          </div>

          <div className={styles.settingsRow}>
            <label>Push-notifikationer:</label>
            {pushEnabled
              ? <span className={styles.pushEnabled}>✅ Aktiveret på denne enhed</span>
              : <button onClick={enablePushNotifications} className={styles.pushBtn}>Aktivér push-notifikationer</button>
            }
          </div>
        </div>
      )}

      <div className={styles.controls}>
        <div className={`${styles.statusMessage} ${styles[statusType]}`}>{statusMessage}</div>
        <div className={styles.todayCount}>
          Dine bookinger i dag: <strong>{getTodayCount()}</strong>/{MAX_BOOKINGS_PER_DAY}
        </div>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Henter bookinger...</div>
      ) : (
        <>
          <div className={styles.gridWrapper}>
            <table className={styles.grid}>
              <thead>
                <tr>
                  <th rowSpan={2} className={styles.timeHeader}>Tid</th>
                  <th>Man</th><th>Tirs</th><th>Ons</th><th>Tors</th><th>Fre</th>
                  <th className={styles.weekend}>Lør</th>
                  <th className={styles.weekend}>Søn</th>
                </tr>
                <tr>
                  {dates.map((date, i) => (
                    <th key={i} className={`${styles.dateCell} ${i >= 5 ? styles.weekend : ''}`}>
                      {date.getDate()} {MONTH_NAMES[date.getMonth()]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map(hour => (
                  <tr key={hour}>
                    <td className={styles.timeCell}>{hour}</td>
                    {DAYS.map((day, dayIndex) => {
                      const key = `${day}|${hour}`;
                      const booking = bookings[key];
                      const isPast = isDateInPast(dates[dayIndex]);
                      let slotClass = `${styles.slot} ${isPast ? styles.past : booking === apartment ? styles.mine : booking ? styles.other : styles.empty}`;
                      return (
                        <td key={day}>
                          <div className={slotClass} onClick={() => handleSlotClick(day, hour, dayIndex)}>
                            {booking || '—'}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.legend}>
            <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.empty}`}></span>Ledig</div>
            <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.mine}`}></span>Din booking</div>
            <div className={styles.legendItem}><span className={`${styles.legendBox} ${styles.other}`}></span>Booket af anden</div>
          </div>
        </>
      )}
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
