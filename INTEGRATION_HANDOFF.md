# MoustacheLeads Support Panel — Integration Handoff

## What this is

This is a fully working support ticket system built in React. It covers three user roles — **Publisher** (your affiliate partners), **Admin** (your support agents), and **Super Admin** (team lead / owner).

Everything runs in the browser right now with no backend. The architecture is intentionally designed so the UI never needs to change — only the data layer gets swapped out when you wire it to your real backend.

**Live demo:** Build and open `dist/index.html` (instructions at the bottom). Click "Load demo data" then pick any role. Open a second tab to be a publisher and an admin simultaneously — tabs sync live.

---

## How it fits into your existing website

Your site already has a Support section. This system drops into that slot. The only things you need to supply:

1. The logged-in user's identity (`id`, `name`, `email`, `role`)
2. API endpoints that match the existing function signatures (detailed below)
3. A server-side cron job for the worker (auto-close timers, scheduled messages)

The UI, all components, the thread layout, the intake wizard, Smart Questions, Offer Check — none of it needs to change.

---

## The three roles

### Publisher (affiliate partner — user-facing)
- Guided chat-style intake wizard — picks a topic, answers questions one at a time
- 7 built-in topics: Postback, iFrame, Offers, Payment, Email/Sign-up, Advertiser credit, Other
- Views their own tickets, replies, and rates closed tickets
- Answers Smart Questions injected into the chat while waiting

### Admin (support agent)
- Inbox with filter tabs: Needs reply, Awaiting user, Solved, No reply, Thumbs down, Flagged
- Full text search across name, email, subject, and message body
- Per-ticket: reply (with scheduling), internal notes, publisher profile panel, audit trail, close/reopen, flag user, quick links, canned replies
- Permissions are per-admin toggles set by the Super Admin

### Super Admin
- Everything Admin can do, plus:
- Assign tickets to admins
- See deleted messages
- Offer Check tool (paste any offer list → instant cross-reference against inventory)
- Smart Questions authoring
- Team permissions management
- Full activity log
- Settings (timer values, toggles)

---

## Key features

| Feature | What it does |
|---|---|
| Guided intake | Publisher answers structured questions per topic before a ticket is created |
| Auto-close (user) | Ticket closes as "No reply" + publisher flagged if publisher doesn't reply within 24h |
| Auto-close (SLA) | Ticket closes as "SLA breach" if admin doesn't reply within 24h |
| Countdown banners | Colour-escalating timers inside each ticket (blue → amber → red) |
| Smart Questions | Pre-authored questions per publisher, auto-sent into chat while they wait |
| Offer Check | Paste offers in any format → see what's in inventory vs missing, annotate, export CSV |
| Scheduled messages | Agent writes a reply, sets a future send time, system fires it automatically |
| Staff chat | Private threads between each admin and the Super Admin — invisible to publishers |
| Drafts | Composer auto-saves; [Draft] badge visible in ticket list |
| Pin messages | Pin any message for 1h / 24h / 7d / forever (SA only) |
| Edit / delete | Agents can edit their own messages; SA can delete any; soft-delete with history |
| Seen receipts | Per-message seen timestamps and "seen by" |
| Internal notes | Team-only notes per ticket; WhatsApp paste auto-detected and cleaned up |
| Publisher profile | Verticals, GEOs, stats, activity timeline — editable by admins with permission |
| Activity log | Full audit trail of every action, filterable by person / action / date |

---

## File map

| File | What it is |
|---|---|
| `src/lib/store.js` | **The only file you need to change for production.** Data layer: `all / get / put / patch / remove`. Replace the adapter with your API calls. |
| `src/lib/logic.js` | All business rules and actions. Every function here becomes one API endpoint. `workerTick()` becomes the server cron job. |
| `src/lib/constants.js` | 7 topics + guided intake flows, permissions list, default timer values |
| `src/lib/offerParser.js` | Offer Check parser — 4 detection modes (tabular, dashboard, blocks, freeform) |
| `src/lib/paste.js` | WhatsApp paste cleaner, file attachment helpers, CSV export |
| `src/lib/seed.js` | Demo data only — **delete for production** |
| `src/ui/Thread.jsx` | Chat thread component: bubbles, seen, pin, edit, delete, scheduled queue, composer, drafts, canned replies |
| `src/views/Publisher.jsx` | Publisher side: my requests, guided intake wizard, chat, wrap-up, rating |
| `src/views/Inbox.jsx` | Admin inbox: tabs, search, topic filter, header actions, banners, notes, profile, audit |
| `src/views/Staff.jsx` | Admin ↔ Super Admin private chat |
| `src/views/SmartQuestions.jsx` | Smart Questions authoring page |
| `src/views/OfferCheck.jsx` | Offer Check tool (also embedded inline inside every Super Admin ticket view) |
| `src/views/Manage.jsx` | Quick links, Submitted Data, Session Log, Activity log, Team permissions, Settings |
| `src/App.jsx` | Entry point: sign-in, navigation, bell notifications, worker loop |

---

## Integration steps

### 1. Remove the sign-in picker — wire your auth

The current sign-in screen is a demo placeholder. Replace it by passing the logged-in user from your existing session:

```js
// What the app expects as the `me` object
const me = {
  id: "user_123",          // your internal user ID
  name: "Jane Smith",
  email: "jane@example.com",
  role: "publisher",       // "publisher" | "admin" | "super_admin"
  perms: { ... }           // for admins — permission toggles (see constants.js PERMISSIONS)
}
```

In `App.jsx`, replace the `<SignIn>` component with your auth check. Pass `me` down to `<Shell>`.

---

### 2. Replace the data adapter in `store.js`

This is the main integration work. The four functions the entire UI uses:

```js
all(table)           // GET /api/{table}
get(table, id)       // GET /api/{table}/{id}
put(table, record)   // POST/PUT /api/{table}/{id}
patch(table, id, p)  // PATCH /api/{table}/{id}
remove(table, id)    // DELETE /api/{table}/{id}
```

The 15 data tables:

```
users, tickets, messages, notes, drafts, links, canned,
activity, notifications, sqsets, intakes, offermarks,
settings, offers, partners
```

Replace the `localAdapter()` / `sharedAdapter()` in `store.js` with an HTTP adapter that calls your API. For real-time updates (tab sync, live inbox), use WebSocket or Server-Sent Events instead of the current `storage` event listener.

---

### 3. Set up the server worker

The `workerTick()` function in `logic.js` handles all timed automation:

- Fire scheduled messages when their `sendAt` time arrives
- Expire pinned messages
- Auto-close tickets (no user reply = "No reply" + flag; no admin reply = SLA breach)
- Send 2-hour warning notifications before auto-close
- Auto-ask Smart Questions after the configured delay

**Run this as a server cron job every 30 seconds.** The function is self-contained — it reads from the store and writes back. On the server, replace `all()` / `patch()` / `put()` with your DB queries.

---

### 4. Move file attachments to object storage

Currently attachments are base64 data URLs stored inside the message record (capped at ~220 KB total). For production:

1. On file select, call your upload endpoint → get back a URL
2. Store only the URL in the message's `attachments` array
3. Update `fileToAttachment()` in `paste.js` to return `{ name, size, type, url }` instead of a base64 data URL

---

### 5. Enforce permissions server-side

Permissions are checked client-side in `permsOf(u)` for UI gating. **Your API must enforce the same checks.** The permission keys:

| Key | What it gates |
|---|---|
| `reply` | Send and schedule replies |
| `close` | Close, reopen, ask wrap-up |
| `flag` | Flag or unflag a publisher |
| `profile` | View and edit publisher profile |
| `notes` | Read and add internal notes |
| `links` | Add/edit/delete quick links and canned replies |
| `allTickets` | See all tickets (off = only assigned or unassigned) |

Super Admin always has all permissions — no overrides possible.

---

### 6. Wire AI refinement (optional)

Smart Questions has an "AI refine" button that currently calls `window.claude.use("sample")` (a Claude artifact capability). For production, replace the `getSample()` call in `store.js` with a call to your backend LLM endpoint (e.g. Claude API, OpenAI).

---

### 7. Delete demo files

- `src/lib/seed.js` — demo data, not needed
- The `<Setup>` and `<SignIn>` components in `App.jsx` — replace with your auth flow

---

## Data model reference

### Ticket
```js
{
  id, type,              // "support" | "staff"
  userId,                // publisher's user ID
  topic,                 // "postback" | "iframe" | "offers" | "payment" | "signup" | "credit" | "other"
  subject, status,       // "open" | "closed"
  closeReason,           // "solved" | "no_reply" | "sla_breach"
  lastFrom,              // "user" | "agent"
  lastUserMsgAt, lastAgentMsgAt, lastAt,
  adminUnread, userUnread,
  firstAgentAt, assigneeId,
  intakeId,
  userRating,            // { thumbs, stars, comment, at }
  adminRating,           // { thumbs, comment, by, at }
  sqFiredAt,
  createdAt, closedAt, reopenedAt
}
```

### Message
```js
{
  id, ticketId,
  sender,        // "user" | "agent" | "system"
  authorId,      // user ID of the sender
  kind,          // "text" | "sq_question" | "sq_answer" | "wrapup" | "joined" | "closed" | "autoclose" | "warn" | ...
  text,
  attachments,   // [{ name, size, type, url }]
  sendAt,        // timestamp — message is visible when sendAt <= now
  scheduleStatus, // null | "scheduled" | "sent" | "cancelled"
  seenAt, seenBy,
  pinnedUntil,   // timestamp | "forever" | null
  deletedAt, deletedBy,
  editedAt, versions,
  createdAt
}
```

### User
```js
{
  id, name, email, role,  // "publisher" | "admin" | "super_admin"
  perms,                  // admin only — { reply, close, flag, profile, notes, links, allTickets }
  flagged, flagReason, flaggedAt,
  verticals, geos,        // publisher profile
  lastActiveAt            // staff only — used for "online" indicator
}
```

---

## Timer defaults (all configurable in Settings)

| Setting | Default | What it does |
|---|---|---|
| `autoCloseMin` | 1440 (24h) | Close ticket if no reply from whoever is expected |
| `userWarnMin` | 120 (2h) | Warn publisher this long before auto-close |
| `adminWarnMin` | 120 (2h) | Warn admin after they've been silent this long |
| `sqDelaySec` | 120 (2 min) | Auto-fire Smart Questions this long after user's first message |

---

## Running the demo

```bash
cd app
npm install
node build.mjs          # builds dist/index.html
# open dist/index.html in your browser
```

First screen: click "Load demo data". Then pick a role. Open a second tab to be a publisher and an admin at the same time — all changes sync live between tabs.

Settings → "Use testing timers" compresses all timers to minutes so you can see auto-close and Smart Questions fire in real time without waiting 24 hours.

---

## What's not built (out of scope for this phase)

- Emailing advertisers from Offer Check
- Real email delivery (all notifications are in-app only)
- Bulk ticket actions
- Offer search inside the chat composer
- Task Collector
- Report broken offer flow
