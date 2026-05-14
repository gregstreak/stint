# Stint

**Do one thing.**

A clean Pomodoro timer PWA. Timed focus in intervals.

Live at: [stint.signalandseed.co.za](https://stint.signalandseed.co.za)

---

## Stack

- Vite + React
- Web Worker for background timing (no browser throttle drift)
- Web Notifications API
- AudioContext chime on completion
- PWA: manifest + service worker, installable on mobile and desktop

## Setup

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
```

Push to GitHub — Vercel auto-deploys on push to `main`.

## DNS (Signal & Seed backend)

Add a CNAME record:

| Name  | Type  | Value                      |
|-------|-------|----------------------------|
| stint | CNAME | cname.vercel-dns.com       |

Then add `stint.signalandseed.co.za` as a custom domain in your Vercel project settings.

## Icons

Add your icons to `/public/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Recommended: "s" letterform in DM Serif Display, amber `#C8A97E` on dark `#0E0E0E` background.

## Palette

| Role         | Hex       |
|--------------|-----------|
| Background   | `#0E0E0E` |
| Text         | `#E8E4DC` |
| Focus        | `#C8A97E` |
| Short break  | `#7EB5A6` |
| Long break   | `#8FA8C8` |

## Fonts

DM Serif Display / DM Sans / DM Mono — all via Google Fonts.
