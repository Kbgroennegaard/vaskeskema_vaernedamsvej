# Vaskeskema Web App – Deployment Guide

## Features
✅ Login pr. lejlighed | ✅ Real-time bookings | ✅ Max 3 moduler/dag
✅ Push-notifikationer | ✅ Email-reminders | ✅ PWA-installérbar | ✅ Gratis

---

## Deployment (15 minutter)

### Trin 1: GitHub
Upload alle filer til dit GitHub repository (se tidligere guide).

### Trin 2: Vercel – Deploy
1. Gå til vercel.com → Import project → vælg dit repository
2. Klik **Deploy**

### Trin 3: Vercel KV Database
1. Vercel dashboard → **Storage** → **Create** → **KV**
2. Giv den et navn → **Create**
3. KV-miljøvariabler tilføjes automatisk

### Trin 4: Environment Variables
Gå til Vercel → Settings → Environment Variables og tilføj:

| Variable | Værdi | Beskrivelse |
|----------|-------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | (se nedenfor) | Push notifikationer |
| `VAPID_PRIVATE_KEY` | (se nedenfor) | Push notifikationer |
| `VAPID_EMAIL` | din@email.dk | Push notifikationer |
| `RESEND_API_KEY` | (se nedenfor) | Email reminders |
| `CRON_SECRET` | (random string) | Sikrer cron-job |
| `NEXT_PUBLIC_APP_URL` | https://dit-link.vercel.app | App URL til emails |

### Trin 5: Generer VAPID keys (til push)
Kør dette i Terminal:
```bash
npx web-push generate-vapid-keys
```
Kopiér Public Key → `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
Kopiér Private Key → `VAPID_PRIVATE_KEY`

### Trin 6: Opret Resend konto (til email)
1. Gå til resend.com → Sign up (gratis)
2. API Keys → Create API Key
3. Kopiér key → `RESEND_API_KEY`

### Trin 7: Redeploy
Vercel → Deployments → nyeste → ··· → **Redeploy**

---

## Login-koder

| Lejlighed | Password |
|-----------|----------|
| 1.th | `1th-vask` |
| 1.tv | `1tv-vask` |
| 2.th | `2th-vask` |
| 2.tv | `2tv-vask` |
| 3.th | `3th-vask` |
| 3.tv | `3tv-vask` |
| 4.th | `4th-vask` |
| 4.tv | `4tv-vask` |
| 5. sal | `5sal-vask` |

---

## Notifikationer

**Push:** Brugere klikker ⚙️ → "Aktivér push-notifikationer" → tillader i browser
**Email:** Brugere indtaster email ved login eller under ⚙️ indstillinger
**Timing:** Cron-job kører hvert 5. minut og sender reminders 30 min før booket tid

---

## Installér som app
**iPhone:** Safari → Del-knap → "Add to Home Screen"
**Android:** Chrome → Menu → "Add to Home screen"
