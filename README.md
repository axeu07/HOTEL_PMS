# Folio hotel suite: sales demo

An interactive hotel management demo, shown running a fictional hotel called **Checkmate Stays**.
It has no backend or database and takes no real payments. Everything runs in the browser, stores its
data in `localStorage`, and works offline once loaded. All people, companies and figures are invented.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # production bundle in dist/
npm run preview      # serve the production bundle
npm run test:e2e     # browser tests (first run: npx playwright install chromium)
```

`dist/` is a static site that can go on any static host. All routes must fall back to `index.html`;
`public/_redirects` already does this for Netlify and Cloudflare Pages.

## Demo logins

Use the **one-click** buttons on the landing page (`/#demo`) or the sign-in page (`/login`), or type:

| Role | Email | Password | Lands on | Can use |
|---|---|---|---|---|
| Hotel Administrator | `admin@vasantacourt.example` | `demo-admin` | Revenue dashboard | Everything, including hotel, room and tax settings |
| General Manager | `manager@vasantacourt.example` | `demo-manager` | Revenue dashboard | Everything except property settings |
| Front Desk | `frontdesk@vasantacourt.example` | `demo-desk` | Arrivals and departures dashboard | Front desk, reservations, guests, restaurant, billing; rooms and housekeeping are view-only |
| Housekeeping | `housekeeping@vasantacourt.example` | `demo-house` | "My tasks" dashboard | Cleaning schedule, room status, maintenance |

While signed in, change role from the account menu (top right) with **Switch demo role**.

**Reset between presentations:** use **Reset demo data** in the account menu (top right) or under Settings > Preferences. It restores the sample story
with dates rebuilt around today. If the data is a day or more old, a banner offers the same reset.

## Customers, leads and booking links

The sidebar is: Dashboard, Customers (Stayed, Leads, Message Templates), Front Desk, Property, Finance / Billing, AI Insights.
Reservations, Restaurant, Reports, Staff, Quick Actions and Settings are hidden from the sidebar (`hidden: true` in
`src/app/navigation.ts`) but keep their routes, permissions and data; the dashboard's "Hotel modules" panel, contextual links,
search and the account menu reach them.

- **Leads** are sample data. Nothing is connected to Meta, Instagram or any booking platform. Add one with Add lead.
- **Messages are not sent from the app.** WhatsApp or the mail app opens with the text written; history records "prepared".
- **Booking links** (`/book/<token>`) are per lead. Booking through one creates a pending reservation (source "Lead booking link") and marks the lead Converted; the desk can also convert a lead with Create booking.
- **Loyalty** is derived, never stored (`src/domain/loyalty.ts`): New 1 stay, Returning 2-3, Regular 4-6, VIP 7+ stays, 350,000+ billed, or a VIP flag.
- Templates use placeholders such as `{guest_name}` and `{booking_link}` (`src/domain/templates.ts`).

## Quick Actions

Hotel Administrator and General Manager get a row of four priority cards on the dashboard and an action
centre at `/app/quick-actions`. Actions are derived from live records in `src/services/quickActions.ts`
and never stored, so finishing the work in its own module is what clears them. Each record raises one
action per job, and the Resolved filter lists what was finished today.

Staff Absent and Late Arrivals read `attendance` records, which are written from **Mark arrived** in Quick
Actions or the Staff roster. Someone counts as absent once their shift is 15 minutes old with no record
(`src/domain/attendance.ts`). There is no self-service clock-in yet. Rooms awaiting inspection, refunds and
guest complaints have no records in the system, so they raise no alerts and the page says so.

## A suggested 10-minute walkthrough

1. **Landing page.** Show the hotel, then use **Check dates** to send a stay request.
   Choose **See it as the front desk**: the request is already in the software as a pending booking.
2. **Confirm and allocate.** On that booking, press **Confirm** and pick a room.
3. **Front Desk.** Check in an arrival. Then check out a departure and take the balance.
4. **Housekeeping.** Switch role. The departed room is on the schedule; start and finish the task, and
   the room turns clean and sellable.
5. **Restaurant.** Place a room service order, move it through the kitchen, then **Add to bill**.
6. **Billing.** Open the invoice from the notification bell. Show the tax split and print the invoice.
7. **Manager.** Show the dashboard, the timeline view in Reservations, and Reports with CSV export.
8. **Settings.** Change the currency or a tax rate to show it is configurable.

## Architecture

```
src/
  types/domain.ts     Interfaces for every entity
  data/               Sample data: fixtures, site copy, and the seed generator
  domain/             Pure business rules: availability, tax, invoice totals
  repositories/       Persistence behind an async Repository<T> interface
  services/           Use cases: check-in, check-out, posting charges, reports
  hooks/useResource   Loads service data and refreshes it after any write
  components/         Design system: UI kit, charts, icons, illustrations
  features/           Workflows shared between pages
  pages/              One file per module, plus public/ for the site and login
  app/                Routing, shell, auth and preferences, navigation, labels
e2e/                  Playwright tests of the demo workflows
```

Dependencies only point downward: `pages → features → services → domain / repositories → data`.
Pages never touch storage, and sample data lives only in `src/data`.

### Moving to a real API

1. Implement `Repository<T>` (`src/repositories/types.ts`) with HTTP calls.
2. Swap the implementation in `src/repositories/index.ts`. That file is the single switch point.
3. Move the multi-step operations in `src/services` to server endpoints, so they run in one
   transaction. Check-in, check-out and walk-in each write several records. The rules in `src/domain`
   are pure functions and can move as they are.
4. Replace `subscribeToData` in `useResource` with query invalidation or a websocket.
5. Replace `authService` with a real identity provider, and **delete `demoPassword`**. Enforce
   permissions on the server: today they only control what the browser shows.

### Before this could go to production

This is a demo, and these are deliberately absent: a server and database, real authentication and
server-side authorisation, a payment gateway, channel manager and OTA connections, email and SMS,
audit logs, multi-property support, and backups. Tax rates in Settings are sample values to confirm with
an adviser. Invoices state that they are not valid tax documents.

### Replacing the illustrations

All hotel imagery is original vector art in `src/components/art.tsx`, so no image hosting is needed.
To tailor a demo to a prospect, replace `<Art />` with `<img>` and use their photos.
