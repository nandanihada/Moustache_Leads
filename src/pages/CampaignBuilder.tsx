import React, { useState, useRef, useEffect } from "react";
import {
  Megaphone, Globe2, DollarSign, Crosshair, Users, CalendarClock, Layers,
  MousePointerClick, MonitorSmartphone, Smartphone, Monitor, Tablet,
  Check, X, Info, Wallet, CreditCard, Bitcoin, Banknote, Building2,
  Sun, Moon, CircleHelp, Sparkles, Plus, ShieldCheck, Zap,
  TrendingUp, Lock, PanelLeftClose, PanelLeftOpen, PanelRightClose, Bell, FileEdit, Clock, ChevronDown, Link, FileText
} from "lucide-react";
import { useSearchParams, useNavigate } from "react-router-dom";

/* ====================================================================
   DEV NOTES — Tier 1 CPA onboarding + Offers/Stats + Wallet
   ====================================================================
   1. AD_FORMATS: "Onclick (Popunder)" tag changed to "Perfect for CPA".
   2. COUNTRIES: added CA, DE. Tier 1 bids — US $1.50, CA $1.30,
      GB $1.30, DE $1.20 — pre-filled by default.
   3. MAIN NAV (header): three top-level sections —
      "Campaign Builder", "My Offers & Stats", "Wallet".
   4. NEW FLOW: "Send to moderation" now pushes the current form into
      an `offers` array with status "pending" and switches to the
      "My Offers & Stats" view.
   5. OffersPage: lists submitted offers with status Pending/Approved.
      "Approve (admin)" button is a DEMO STAND-IN for the real admin
      approval action — in production this must be admin-only, not
      visible to the advertiser. On approve, demo stats (impressions,
      clicks, conversions, spend) populate the card.
   6. WALLET / DepositPage:
      - USDT: shows a static wallet address to send funds to
        manually; no live gateway yet.
      - PayPal: marked "Coming soon" / disabled — still need to
        integrate a real PayPal payment gateway before enabling.

   STILL UNCHANGED / INTENTIONALLY KEPT:
   - CPA pricing still shows "S2S tracking required" note and the
     amber warning in Schedule section.
   - Quality Guidelines checkbox still gates "Send to moderation".

   ====================================================================
   CHANGELOG — Round 2 (what happened in this revision)
   ====================================================================
   • Added styled hover Tooltip component. Every "?" (CircleHelp) and the
     lock-badge tooltips now reveal their meaning on hover instead of
     using the slow native browser title. Decorative inline "i" icons that
     already sit next to full sentences were left as-is.
   • LOCKED OPTIONS (admin-controlled, not self-serve):
       - Traffic Sources → "Member area" is now locked.
       - Retargeting → "Collect users who completed conversions" is locked.
     Locked options stay visible but are non-selectable: greyed at ~62%
     opacity, show a "Lock + Admin" badge, cursor not-allowed, and clicking
     does nothing. Hovering the badge explains it's allocated/configured by
     our team on request.
   • Removed the "RewardCash" brand from the campaign-name example
     placeholder (now a generic geo/format example). No other brand names
     remain in the file.

   ====================================================================
   CHANGELOG — Round 3 (this revision)
   ====================================================================
   • REMOVED COUNTRY BUDGET SPLIT: the per-country budget-allocation %
     (sliders + auto-balancing to 100%) is gone. Now that the campaign
     uses a single flat rate per conversion, a per-country budget split
     was redundant — it didn't change pricing or payouts, which are
     admin-side. Countries is now a plain searchable multi-select with
     a "Remove" action per selected country. Removed: `ratios` from form
     state, `evenRatios`/`setRatio` helpers, the split table UI, the
     split bars in the Live Summary, and `budget_ratio` from the
     offer_countries data model. The daily/total budget cap and rate per
     conversion are unchanged and remain the three distinct levers
     (rate = price/conversion, daily cap = pacing brake, total = lifetime
     ceiling).
   • FORM VALIDATION: "Send to moderation" now validates before submit —
     campaign name required, target URL must be a valid http(s) URL,
     at least one country selected, CPA rate > 0 (when pricing = CPA),
     daily/total budget > 0 (depending on budget mode), and Quality
     Guidelines must be checked. Invalid fields show inline red error
     messages; submission is blocked until fixed.
   • DUPLICATE SUBMISSION GUARD: "Send to moderation" now sets a
     `submitting` state, disables the button, and shows a spinner +
     "Submitting…" during the (simulated) API call, preventing duplicate
     offer creation from repeated clicks.
   • REMOVED BUILD NOTES PANEL: the advertiser-facing "Build notes (dev
     reference — remove before launch)" panel on the Campaign Builder
     page has been removed. The Implementation Notes page (internal,
     not advertiser-facing) remains as the source of dev/ops documentation.
   ==================================================================== */

/* ====================================================================
   CHANGELOG — Round 4 (this revision)
   ====================================================================
   • SAVE AS DRAFT: new button next to "Send to moderation" in the Live
     Summary. Saves the current form to `offers` with status="draft" —
     only the campaign name is required (no full validation), the offer
     does NOT appear in the admin moderation queue, and it stays fully
     editable. My Offers & Stats now shows a "Draft" status badge with
     Edit (reopens the form, pre-filled, via a new `editOffer`/`editingId`
     flow — the toolbar shows an "Editing draft" pill) and Delete actions.
     Promoting a draft to "Send to moderation" now reads "Start Campaign"
     and runs the full validation as before, then flips status to
     "pending" in place (same offer id).
   • TIMEZONE SELECTOR (audit item #6): added `form.timezone` (default
     "UTC") with a dropdown (UTC/EST/PST/GMT/CET/IST/advertiser-local) in
     the Budget step, shown only when budget_mode="daily" — explains that
     the daily cap resets at midnight in the selected zone. Also surfaced
     read-only in the top toolbar next to the notifications bell. Added
     `timezone` to the offers data model table.
   • NOTIFICATIONS CENTER (audit item #11): added a bell icon in the
     toolbar with an unread-count dot and a dropdown feed. Events are
     pushed client-side for now: offer submitted, draft saved, and offer
     approved (admin demo action). Opening the bell marks all as read.
     Added a `notifications` table to the data model — in production this
     feed is server-generated, not client-generated.
   ==================================================================== */

/* ====================================================================
   CHANGELOG — Round 5 (this revision)
   ====================================================================
   • BROWSER LANGUAGE TARGETING: new chip group in Targeting (English,
     Spanish, Portuguese, Arabic, Hindi, French, German, Indonesian,
     Russian, Turkish). Added `browserLanguages` to form state and
     `browser_languages` to the offer_targeting data model.
   • VPN / FRAUD CONTROL (audit item #7, partial): new "VPN traffic"
     toggle in Targeting — All traffic / No VPN / Only VPN. Defaults to
     "all". "No VPN" is the recommended setting for CPA offers. Added
     `vpn` to form state and offer_targeting. Shown in the Live Summary
     when not "all".
   • SPEND ALERT: new "Notify me when spend reaches a threshold" checkbox
     in the Budget step (hidden when budget_mode="unlimited"), with a
     dollar-amount field. Added `alertEnabled`/`alertThreshold` to form
     state and `alert_enabled`/`alert_threshold_cents` to the offers data
     model, plus a `spend_alert` notification type. Shown in the Live
     Summary when set.
   ==================================================================== */

/* ====================================================================
   THEME  — bold, branded, gradient-forward
   ==================================================================== */
const makeTheme = (dark) => ({
  bg: dark ? "#0c0a14" : "#f5f3fb",
  bgGrad: dark
    ? "radial-gradient(900px 480px at 88% -8%, rgba(124,58,237,0.20), transparent), radial-gradient(700px 420px at -6% 14%, rgba(168,85,247,0.10), transparent), #0c0a14"
    : "radial-gradient(900px 480px at 88% -8%, rgba(124,58,237,0.10), transparent), radial-gradient(700px 420px at -6% 14%, rgba(168,85,247,0.06), transparent), #f5f3fb",
  panel: dark ? "#151320" : "#ffffff",
  panelAlt: dark ? "#1d1a2b" : "#f6f4fc",
  glass: dark ? "rgba(21,19,32,0.8)" : "rgba(255,255,255,0.82)",
  border: dark ? "#2a2640" : "#e8e3f5",
  borderHi: dark ? "#3d3858" : "#d3cbeb",
  text: dark ? "#ece9f5" : "#171221",
  textDim: dark ? "#9d97b5" : "#6a6385",
  textFaint: dark ? "#67617e" : "#a39db8",
  brand: "#7c3aed",
  brand2: "#a855f7",
  brandGrad: "linear-gradient(125deg,#7c3aed 0%,#9333ea 50%,#a855f7 100%)",
  brandSoft: dark ? "rgba(124,58,237,0.18)" : "rgba(124,58,237,0.08)",
  green: "#10b981",
  greenSoft: dark ? "rgba(16,185,129,0.16)" : "rgba(16,185,129,0.10)",
  amber: "#f59e0b",
  amberSoft: dark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.11)",
  red: "#ef4444",
  shadow: dark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 10px 30px rgba(124,58,237,0.12)",
  shadowSm: dark ? "0 2px 8px rgba(0,0,0,0.35)" : "0 2px 8px rgba(124,58,237,0.07)",
  glow: "0 4px 16px rgba(124,58,237,0.30)",
});

/* ====================================================================
   DATA
   ==================================================================== */
const SECTIONS = [
  { id: "main", label: "Main", Icon: Megaphone },
  { id: "traffic", label: "Traffic", Icon: Layers },
  { id: "countries", label: "Countries & Bid", Icon: Globe2 },
  { id: "budget", label: "Budget", Icon: DollarSign },
  { id: "targeting", label: "Targeting", Icon: Crosshair },
  { id: "retargeting", label: "Retargeting", Icon: Users },
  { id: "schedule", label: "Schedule", Icon: CalendarClock },
];

const AD_FORMATS = [
  { id: "popunder", name: "Onclick (Popunder)", desc: "Full-page ad on click. Highest volume — perfect for CPA campaigns.", Icon: MousePointerClick, tag: "Perfect for CPA" },
  { id: "push", name: "Push Notifications", desc: "Clickable alerts to subscribed users.", Icon: Megaphone, tag: null },
  { id: "inpage", name: "In-Page Push", desc: "Push-style banners inside the page.", Icon: MonitorSmartphone, tag: null },
  { id: "interstitial", name: "Interstitial", desc: "Full-screen ad between transitions.", Icon: Monitor, tag: null },
];
const PRICING = [
  { id: "cpa", name: "CPA Goal", desc: "Pay per conversion. Set a target, system optimizes.", note: "S2S tracking required", Icon: Crosshair, recommend: true },
  { id: "cpm", name: "CPM", desc: "Pay per 1,000 impressions. Full bid control.", note: "Best for testing", Icon: Zap, recommend: false },
];
const TRAFFIC_TYPES = [
  { id: "all", name: "All traffic", desc: "Entire available inventory." },
  { id: "mainstream", name: "Mainstream", desc: "General audiences, broad reach." },
  { id: "member", name: "Member area", desc: "Premium engaged users.", locked: true, lockNote: "Admin-controlled — allocated to your campaign by our team, not self-serve." },
];
const CONNECTION = ["All", "Wi-Fi", "Mobile"];
const OS_LIST = ["Android", "iOS", "Windows", "macOS", "Linux"];
const BROWSERS = ["Chrome", "Safari", "Firefox", "Edge", "Opera", "Samsung"];
const BROWSER_LANGUAGES = ["English", "Spanish", "Portuguese", "Arabic", "Hindi", "French", "German", "Indonesian", "Russian", "Turkish"];
const COUNTRIES = [
  { code: "IN", name: "India", flag: "🇮🇳", bid: 1.6 },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", bid: 0.9 },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", bid: 0.8 },
  { code: "BR", name: "Brazil", flag: "🇧🇷", bid: 1.4 },
  { code: "NG", name: "Nigeria", flag: "🇳🇬", bid: 0.7 },
  { code: "ID", name: "Indonesia", flag: "🇮🇩", bid: 1.1 },
  { code: "US", name: "United States", flag: "🇺🇸", bid: 1.5 },
  { code: "CA", name: "Canada", flag: "🇨🇦", bid: 1.3 },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧", bid: 1.3 },
  { code: "DE", name: "Germany", flag: "🇩🇪", bid: 1.2 },
  { code: "AE", name: "UAE", flag: "🇦🇪", bid: 2.8 },
  { code: "FR", name: "France", flag: "🇫🇷", bid: 1.2 },
  { code: "IT", name: "Italy", flag: "🇮🇹", bid: 1.0 },
  { code: "ES", name: "Spain", flag: "🇪🇸", bid: 1.0 },
  { code: "NL", name: "Netherlands", flag: "🇳🇱", bid: 1.4 },
  { code: "AU", name: "Australia", flag: "🇦🇺", bid: 2.2 },
  { code: "JP", name: "Japan", flag: "🇯🇵", bid: 1.9 },
  { code: "KR", name: "South Korea", flag: "🇰🇷", bid: 1.7 },
  { code: "MX", name: "Mexico", flag: "🇲🇽", bid: 0.9 },
  { code: "AR", name: "Argentina", flag: "🇦🇷", bid: 0.7 },
  { code: "ZA", name: "South Africa", flag: "🇿🇦", bid: 0.8 },
  { code: "EG", name: "Egypt", flag: "🇪🇬", bid: 0.6 },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦", bid: 2.4 },
  { code: "TR", name: "Turkey", flag: "🇹🇷", bid: 0.8 },
  { code: "PH", name: "Philippines", flag: "🇵🇭", bid: 0.9 },
  { code: "VN", name: "Vietnam", flag: "🇻🇳", bid: 0.7 },
  { code: "TH", name: "Thailand", flag: "🇹🇭", bid: 0.9 },
  { code: "MY", name: "Malaysia", flag: "🇲🇾", bid: 1.1 },
  { code: "PL", name: "Poland", flag: "🇵🇱", bid: 1.0 },
  { code: "SE", name: "Sweden", flag: "🇸🇪", bid: 1.5 },
  { code: "CH", name: "Switzerland", flag: "🇨🇭", bid: 2.6 },
  { code: "RU", name: "Russia", flag: "🇷🇺", bid: 0.6 },
];
const TIMEZONES = [
  { id: "UTC", label: "UTC (Coordinated Universal Time)" },
  { id: "EST", label: "EST (Eastern, UTC-5)" },
  { id: "PST", label: "PST (Pacific, UTC-8)" },
  { id: "GMT", label: "GMT (Greenwich Mean Time)" },
  { id: "CET", label: "CET (Central European, UTC+1)" },
  { id: "IST", label: "IST (India, UTC+5:30)" },
  { id: "advertiser", label: "My local timezone (browser default)" },
];
const PAYMENT_METHODS = [
  { id: "card", name: "Credit / Debit Card", desc: "Visa, Mastercard. Instant.", Icon: CreditCard, badge: "Instant", min: 25 },
  { id: "usdt", name: "USDT (TRC20 / ERC20)", desc: "Tether. Send to our wallet address below.", Icon: Bitcoin, badge: "Manual", min: 50, address: "TXy9k2Lp8mQeR4vWnZ3hC7tF6sB1dGj5Ku", disabled: false },
  { id: "btc", name: "Bitcoin", desc: "BTC on-chain.", Icon: Bitcoin, badge: "Coming soon", min: 50, disabled: true },
  { id: "paypal", name: "PayPal", desc: "Pay with your PayPal account or card.", Icon: Wallet, badge: "Instant", min: 25 },
  { id: "capitalist", name: "Capitalist", desc: "Popular with buyers.", Icon: Banknote, badge: "Coming soon", min: 50, disabled: true },
  { id: "webmoney", name: "WebMoney", desc: "WMZ transfer.", Icon: Banknote, badge: "Coming soon", min: 50, disabled: true },
  { id: "wire", name: "Bank Wire", desc: "SWIFT. 1–3 days.", Icon: Building2, badge: "Coming soon", min: 500, disabled: true },
];

/* ====================================================================
   PRIMITIVES
   ==================================================================== */
const inputStyle = (t: any): React.CSSProperties => ({
  width: "100%", padding: "11px 13px", borderRadius: 6, border: `1px solid ${t.border}`,
  background: t.panelAlt, color: t.text, fontSize: 14, outline: "none", boxSizing: "border-box" as const,
  fontFamily: "inherit", transition: "border .12s, box-shadow .12s",
});

function Toggle({ active, onClick, t, children }: any) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "8px 15px", borderRadius: 6, fontSize: 13.5, fontWeight: 600, cursor: "pointer", transition: "all .12s",
      border: `1px solid ${active ? t.brand : t.border}`,
      background: active ? t.brandSoft : t.panel, color: active ? t.brand : t.textDim,
    }}>{children}</button>
  );
}
function Chip({ active, onClick, t, children }: any) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "7px 13px", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer", transition: "all .12s",
      border: `1px solid ${active ? t.brand : t.border}`,
      background: active ? t.brandSoft : t.panel, color: active ? t.brand : t.textDim,
      display: "inline-flex", alignItems: "center", gap: 6,
    }}>{active && <Check size={13} />}{children}</button>
  );
}
function FieldLabel({ t, children, hint }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
      <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.1 }}>{children}</span>
      {hint && <Tooltip t={t} text={hint}><CircleHelp size={14} color={t.textFaint} style={{ cursor: "help", display: "block" }} /></Tooltip>}
    </div>
  );
}

/* Styled hover tooltip — wraps any trigger (the ? and i icons, lock icons). */
function Tooltip({ t, text, children, width = 230 }: any) {
  const [show, setShow] = useState(false);
  return (
    <span
      style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%", transform: "translateX(-50%)",
          width, background: t.text, color: t.bg, fontSize: 12, fontWeight: 500, lineHeight: 1.5,
          padding: "9px 11px", borderRadius: 9, boxShadow: t.shadow, zIndex: 100, textAlign: "left",
          letterSpacing: 0, pointerEvents: "none",
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%", transform: "translateX(-50%)",
            width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent",
            borderTop: `6px solid ${t.text}`,
          }} />
        </span>
      )}
    </span>
  );
}

/* Notifications bell — dropdown feed of account events (offer submitted,
   draft saved, campaign approved, low balance, etc). */
function NotificationsBell({ t, notifications, unreadCount, onMarkAllRead }: any) {
  const [open, setOpen] = useState(false);
  const fmtTime = (ts: any) => {
    const mins = Math.round((Date.now() - ts.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    return `${hrs}h ago`;
  };
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) onMarkAllRead(); }}
        title="Notifications"
        style={{ width: 36, height: 36, borderRadius: 7, border: `1px solid ${t.border}`, background: open ? t.brandSoft : t.panel, color: open ? t.brand : t.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: 999, background: t.red, border: `2px solid ${t.panel}` }} />
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 300, maxHeight: 360, overflowY: "auto", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 10, boxShadow: t.shadow, zIndex: 200 }}>
          <div style={{ padding: "11px 14px", borderBottom: `1px solid ${t.border}`, fontWeight: 700, fontSize: 13 }}>Notifications</div>
          {notifications.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: t.textFaint, fontSize: 12.5 }}>No notifications yet.</div>
          ) : (
            notifications.map((n: any) => (
              <div key={n.id} style={{ display: "flex", gap: 10, padding: "11px 14px", borderBottom: `1px solid ${t.border}`, alignItems: "flex-start" }}>
                <Bell size={14} color={t.textFaint} style={{ marginTop: 2, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: t.textFaint, marginTop: 3 }}>{fmtTime(n.ts)}</div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
function SelectCard({ t, active, onClick, Icon, title, desc, tag, tagColor, foot }: any) {
  return (
    <button type="button" onClick={onClick} style={{
      textAlign: "left", padding: 14, borderRadius: 8, cursor: "pointer", position: "relative", transition: "all .12s",
      border: `2px solid ${active ? t.brand : t.border}`,
      background: active ? t.brandSoft : t.panel,
    }}>
      {tag && <span style={{ position: "absolute", top: 12, right: 12, fontSize: 10.5, fontWeight: 700, color: tagColor || t.brand, background: (tagColor || t.brand) + "1a", padding: "2px 8px", borderRadius: 4 }}>{tag}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ width: 34, height: 34, borderRadius: 6, background: active ? t.brandSoft : t.panelAlt, color: active ? t.brand : t.textDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon size={17} /></div>
        <span style={{ fontWeight: 600, fontSize: 14, letterSpacing: -0.1 }}>{title}</span>
      </div>
      <div style={{ fontSize: 12.5, color: t.textDim, lineHeight: 1.5 }}>{desc}</div>
      {foot && <div style={{ fontSize: 11.5, color: t.amber, background: t.amberSoft, padding: "3px 9px", borderRadius: 4, display: "inline-block", marginTop: 9, fontWeight: 600 }}>{foot}</div>}
    </button>
  );
}
function Radio({ t, active }: any) {
  return (
    <div style={{ width: 20, height: 20, borderRadius: 999, border: `2px solid ${active ? t.brand : t.borderHi}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all .12s" }}>
      {active && <div style={{ width: 10, height: 10, borderRadius: 999, background: t.brand }} />}
    </div>
  );
}

function Block({ t, id, n, title, sub, refMap, children }: any) {
  return (
    <section ref={(el) => (refMap.current[id] = el)} id={id} data-tour={`sec-${id}`} style={{ scrollMarginTop: 16, marginBottom: 12 }}>
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, padding: 20, boxShadow: t.shadowSm }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${t.border}` }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: t.brandGrad, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700, flexShrink: 0, boxShadow: t.shadowSm }}>{n}</span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, letterSpacing: -0.2 }}>{title}</h2>
            {sub && <p style={{ fontSize: 12.5, color: t.textDim, margin: "2px 0 0", lineHeight: 1.45 }}>{sub}</p>}
          </div>
        </div>
        {children}
      </div>
    </section>
  );
}

/* Searchable multi-select for countries: type to filter, click/Enter to add,
   selected shown as removable tags. Dropdown closes on outside click / Esc. */
function CountrySelect({ t, selected, onToggle }: any) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onDoc = (e: any) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const matches = COUNTRIES.filter((c: any) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return c.name.toLowerCase().includes(s) || c.code.toLowerCase().includes(s);
  });

  const add = (code: string) => { onToggle(code); setQ(""); setHi(0); inputRef.current?.focus(); };

  const onKey = (e: any) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); if (matches[hi]) add(matches[hi].code); }
    else if (e.key === "Escape") { setOpen(false); }
    else if (e.key === "Backspace" && !q && selected.length) { onToggle(selected[selected.length - 1]); }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", marginBottom: 18 }}>
      {/* input box with inline tags */}
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        style={{
          display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, minHeight: 46,
          padding: "7px 9px", borderRadius: 8, cursor: "text",
          border: `1px solid ${open ? t.brand : t.border}`, background: t.panelAlt,
          boxShadow: open ? `0 0 0 3px ${t.brandSoft}` : "none", transition: "all .12s",
        }}
      >
        {selected.map((code: string) => {
          const c = COUNTRIES.find((x) => x.code === code);
          if (!c) return null;
          return (
            <span key={code} style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600,
              background: t.brandSoft, color: t.brand, border: `1px solid ${t.brand}33`,
              padding: "4px 6px 4px 9px", borderRadius: 6,
            }}>
              {c.flag} {c.name}
              <span onClick={(e) => { e.stopPropagation(); onToggle(code); }} style={{ display: "inline-flex", cursor: "pointer", opacity: 0.7 }}>
                <X size={13} />
              </span>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={selected.length ? "Add another country…" : "Search countries to target…"}
          style={{ flex: 1, minWidth: 140, border: "none", outline: "none", background: "transparent", color: t.text, fontSize: 14, padding: "5px 4px", fontFamily: "inherit" }}
        />
      </div>

      {/* dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 60,
          background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, boxShadow: t.shadow,
          maxHeight: 280, overflowY: "auto", padding: 5,
        }}>
          {matches.length === 0 ? (
            <div style={{ padding: "14px 12px", fontSize: 13, color: t.textFaint, textAlign: "center" }}>No countries match “{q}”.</div>
          ) : matches.map((c, i) => {
            const on = selected.includes(c.code);
            const active = i === hi;
            return (
              <button
                key={c.code}
                type="button"
                onMouseEnter={() => setHi(i)}
                onClick={() => add(c.code)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
                  padding: "9px 10px", border: "none", borderRadius: 6, cursor: "pointer",
                  background: active ? t.brandSoft : "transparent", color: t.text, fontSize: 13.5, fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 17, width: 22 }}>{c.flag}</span>
                <span style={{ flex: 1 }}>{c.name}</span>
                {on
                  ? <Check size={16} color={t.brand} />
                  : <Plus size={15} color={t.textFaint} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ====================================================================
   PRODUCT TOUR (spotlight overlay)
   ==================================================================== */
const TOUR_STEPS = [
  { sel: '[data-tour="rail"]', side: "bottom", title: "Your workspace", body: "This navigation bar switches between sections — Campaign Builder, campaigns, your offers & stats, wallet, and notes." },
  { sel: '[data-tour="steps"]', side: "right", title: "Campaign steps", body: "Jump between the parts of your campaign here. You can collapse this anytime to get more room." },
  { sel: '[data-tour="sec-main"]', side: "right", title: "1 · Basics", body: "Name your campaign, set the landing URL, pick the ad format (Popunder is best for CPA) and how you're billed." },
  { sel: '[data-tour="sec-traffic"]', side: "right", title: "2 · Traffic", body: "Choose which inventory your ads run on. Some sources are admin-controlled and shown locked." },
  { sel: '[data-tour="sec-countries"]', side: "right", title: "3 · Countries", body: "Search and add the geos you want to target. Bidding and payouts are handled on our side." },
  { sel: '[data-tour="sec-budget"]', side: "right", title: "4 · Budget", body: "Set your rate per conversion (what you pay per result) and a daily, total, or unlimited spend cap. Campaigns pause if your balance hits zero." },
  { sel: '[data-tour="sec-targeting"]', side: "right", title: "5 · Targeting", body: "Narrow by device, OS, browser and connection. Leave a group empty to target everyone." },
  { sel: '[data-tour="sec-retargeting"]', side: "right", title: "6 · Retargeting", body: "Optionally build an audience from this campaign. Converter-retargeting is set up by our team." },
  { sel: '[data-tour="sec-schedule"]', side: "right", title: "7 · Launch", body: "Confirm auto-start and accept the Quality Guidelines — that unlocks the submit button. Your campaign goes live once we approve it." },
  { sel: '[data-tour="funds"]', side: "bottom", title: "Add funds", body: "Top up your balance here. Cards, USDT, and more are supported on the wallet page." },
  { sel: '[data-tour="summary"]', side: "left", title: "Live summary", body: "Everything you pick updates here in real time, with your setup progress. You can hide it for more space." },
  { sel: '[data-tour="submit"]', side: "left", title: "Submit Campaign", body: "When you're funded and the form's complete, submit. We'll review it before it goes live — it shows as Pending in the meantime." },
];

function Tour({ t, step, total, rect, side, title, body, onNext, onPrev, onClose }: any) {
  if (!rect) return null;
  const pad = 6;
  const hole = { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 };

  // tooltip placement
  const TW = 300, gap = 14;
  let tip = { top: 0, left: 0 };
  const vh = window.innerHeight, vw = window.innerWidth;
  if (side === "right") tip = { top: Math.min(Math.max(hole.top, 12), vh - 200), left: Math.min(hole.left + hole.width + gap, vw - TW - 12) };
  else if (side === "left") tip = { top: Math.min(Math.max(hole.top, 12), vh - 200), left: Math.max(hole.left - TW - gap, 12) };
  else if (side === "bottom") tip = { top: hole.top + hole.height + gap, left: Math.min(Math.max(hole.left, 12), vw - TW - 12) };
  else tip = { top: Math.max(hole.top - 180, 12), left: Math.min(Math.max(hole.left, 12), vw - TW - 12) };

  const first = step === 0, last = step === total - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
      {/* dim overlay with a transparent hole via huge box-shadow */}
      <div
        onClick={onClose}
        style={{
          position: "absolute", top: hole.top, left: hole.left, width: hole.width, height: hole.height,
          borderRadius: 10, boxShadow: "0 0 0 9999px rgba(15,12,25,0.66)", transition: "all .25s ease",
          pointerEvents: "auto",
        }}
      />
      {/* highlight ring */}
      <div style={{ position: "absolute", top: hole.top, left: hole.left, width: hole.width, height: hole.height, borderRadius: 10, border: `2px solid ${t.brand2}`, boxShadow: t.glow, pointerEvents: "none", transition: "all .25s ease" }} />

      {/* tooltip */}
      <div style={{ position: "absolute", top: tip.top, left: tip.left, width: TW, background: t.panel, borderRadius: 12, boxShadow: t.shadow, border: `1px solid ${t.border}`, overflow: "hidden" }}>
        <div style={{ height: 4, background: t.brandGrad }} />
        <div style={{ padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: t.brand, textTransform: "uppercase" as const, letterSpacing: 0.6 }}>Step {step + 1} of {total}</span>
            <button type="button" onClick={onClose} style={{ background: "none", border: "none", color: t.textFaint, cursor: "pointer", padding: 2, display: "flex" }}><X size={16} /></button>
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: -0.2 }}>{title}</div>
          <div style={{ fontSize: 13, color: t.textDim, lineHeight: 1.55, marginTop: 5 }}>{body}</div>

          {/* progress dots */}
          <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} style={{ flex: 1, height: 3, borderRadius: 99, background: i <= step ? t.brand : t.border }} />
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14 }}>
            <button type="button" onClick={onClose} style={{ fontSize: 12.5, fontWeight: 600, color: t.textDim, background: "none", border: "none", cursor: "pointer", marginRight: "auto" }}>Skip tour</button>
            {!first && <button type="button" onClick={onPrev} style={{ fontSize: 13, fontWeight: 600, color: t.text, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 13px", cursor: "pointer" }}>Back</button>}
            <button type="button" onClick={onNext} style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: t.brandGrad, border: "none", borderRadius: 7, padding: "7px 15px", cursor: "pointer", boxShadow: t.glow }}>{last ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   MAIN
   ==================================================================== */
export default function CampaignBuilder() {
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [dark, setDark] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get("view") || "builder";
  const setView = (newView: string) => {
    navigate(`/advertiser/campaign-builder?view=${newView}`);
  };
  const [balance, setBalance] = useState(0);
  const [active, setActive] = useState("main");
  const refMap = useRef<Record<string, HTMLElement | null>>({});
  const t = makeTheme(dark);

  // Offers submitted by this advertiser.
  const [offers, setOffers] = useState<any[]>([]);

  // Notifications center — simple in-memory feed of account events
  const [notifications, setNotifications] = useState<any[]>([]);
  const pushNotification = (text: string) => {
    setNotifications((n) => [{ id: Date.now(), text, read: false, ts: new Date() }, ...n]);
  };
  const markAllRead = () => setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [editingId, setEditingId] = useState<any>(null);

  const [form, setForm] = useState({
    name: "", format: "popunder", pricing: "cpa", targetUrl: "",
    traffic: "all", countries: ["US", "CA", "GB", "DE"], bids: { US: 1.5, CA: 1.3, GB: 1.3, DE: 1.2 },
    budgetMode: "daily", dailyBudget: "", totalBudget: "", cpaGoal: "",
    alertEnabled: false, alertThreshold: "",
    devices: ["mobile"], os: ["Android"], browsers: [], browserLanguages: [], connection: "All", vpn: "all",
    retarget: "none", autoStart: true, quality: false, timezone: "UTC",
    zoneMode: "include", zones: "",
  });
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  // Toggle a country on/off.
  const toggleCountry = (code: string) => {
    const has = form.countries.includes(code);
    const next = has ? form.countries.filter((x) => x !== code) : [...form.countries, code];
    setForm((f) => ({ ...f, countries: next }));
  };

  // Fetch campaigns and wallet balance from the database
  const fetchInitialData = async () => {
    try {
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      // Fetch profile for real balance
      const profileRes = await fetch(`${API_BASE}/api/advertiser/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (profileRes.ok) {
        const profileData = await profileRes.json();
        if (profileData.profile && profileData.profile.balance !== undefined) {
          setBalance(profileData.profile.balance);
        }
      }

      // Fetch advertiser campaigns
      const campaignsRes = await fetch(`${API_BASE}/api/advertiser/campaigns`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (campaignsRes.ok) {
        const campaignsData = await campaignsRes.json();
        const mapped = campaignsData.campaigns.map((c: any) => {
          if (c.form_data) {
            return {
              ...c.form_data,
              id: c._id,
              status: c.status,
              stats: {
                impressions: c.impressions || 0,
                clicks: c.clicks || 0,
                conversions: c.conversions || 0,
                spend: c.spent || 0
              }
            };
          }
          return {
            id: c._id,
            name: c.name || "Untitled Campaign",
            format: c.campaign_type || "popunder",
            pricing: c.bid_type || "cpa",
            targetUrl: c.landing_url || "",
            countries: c.target_countries || [],
            devices: c.target_devices || [],
            os: c.target_os || [],
            browsers: c.target_browsers || [],
            dailyBudget: c.daily_limit?.toString() || "",
            totalBudget: c.total_budget?.toString() || "",
            cpaGoal: c.bid_amount?.toString() || "",
            status: c.status || "draft",
            stats: {
              impressions: c.impressions || 0,
              clicks: c.clicks || 0,
              conversions: c.conversions || 0,
              spend: c.spent || 0
            },
            quality: true,
            autoStart: true,
            alertEnabled: false,
            timezone: "UTC"
          };
        });
        setOffers(mapped);
      }
    } catch (err) {
      console.error("Failed to load advertiser data:", err);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [view]);

  // Submit the current form as a new offer, in "pending" status.
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<any>({});

  const validate = (f: any) => {
    const e: any = {};
    if (!f.name.trim()) e.name = "Campaign name is required.";
    if (!f.targetUrl.trim()) e.targetUrl = "Target URL is required.";
    else if (!/^https?:\/\/.+/i.test(f.targetUrl.trim())) e.targetUrl = "Enter a valid URL starting with http(s)://";
    if (f.countries.length === 0) e.countries = "Select at least one country.";
    if (f.pricing === "cpa") {
      const cpa = Number(f.cpaGoal);
      if (!f.cpaGoal || isNaN(cpa) || cpa <= 0) e.cpaGoal = "Enter a rate per conversion greater than 0.";
    }
    if (f.budgetMode === "daily") {
      const v = Number(f.dailyBudget);
      if (!f.dailyBudget || isNaN(v) || v <= 0) e.dailyBudget = "Enter a daily spend cap greater than 0.";
    }
    if (f.budgetMode === "total") {
      const v = Number(f.totalBudget);
      if (!f.totalBudget || isNaN(v) || v <= 0) e.totalBudget = "Enter a total budget greater than 0.";
    }
    if (f.zones) {
      const list = f.zones.split(',').map((z: string) => z.trim()).filter(Boolean);
      if (list.length > 5000) {
        e.zones = "Maximum 5000 zones allowed.";
      }
    }
    if (!f.quality) e.quality = "Accept the Quality Guidelines to submit.";
    return e;
  };

  const submitOffer = async () => {
    if (submitting) return;
    const e = validate(form);
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    try {
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      const payload = {
        name: form.name,
        campaign_type: form.format,
        status: "pending",
        bid_type: form.pricing,
        bid_amount: form.pricing === "cpa" ? parseFloat(form.cpaGoal || "0") : 0.05,
        daily_limit: parseFloat(form.dailyBudget || "10.0"),
        total_budget: parseFloat(form.totalBudget || "0"),
        target_countries: form.countries,
        target_devices: form.devices,
        target_os: form.os,
        target_browsers: form.browsers,
        landing_url: form.targetUrl,
        form_data: form
      };

      let res;
      if (editingId) {
        res = await fetch(`${API_BASE}/api/advertiser/campaigns/${editingId}`, {
          method: "PUT",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/api/advertiser/campaigns`, {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        pushNotification(`"${form.name || "Untitled campaign"}" submitted for moderation.`);
        setErrors({});
        setEditingId(null);
        setForm({
          name: "", format: "popunder", pricing: "cpa", targetUrl: "",
          traffic: "all", countries: ["US", "CA", "GB", "DE"], bids: { US: 1.5, CA: 1.3, GB: 1.3, DE: 1.2 },
          budgetMode: "daily", dailyBudget: "", totalBudget: "", cpaGoal: "",
          alertEnabled: false, alertThreshold: "",
          devices: ["mobile"], os: ["Android"], browsers: [], browserLanguages: [], connection: "All", vpn: "all",
          retarget: "none", autoStart: true, quality: false, timezone: "UTC",
          zoneMode: "include", zones: "",
        });
        await fetchInitialData();
        setView("offers");
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to submit campaign");
      }
    } catch (err) {
      console.error("Submit campaign error:", err);
      alert("An error occurred while submitting campaign");
    } finally {
      setSubmitting(false);
    }
  };

  const [savingDraft, setSavingDraft] = useState(false);
  const saveDraft = async () => {
    if (savingDraft || submitting) return;
    if (!form.name.trim()) {
      setErrors((er) => ({ ...er, name: "Give your draft a name so you can find it later." }));
      return;
    }
    setSavingDraft(true);
    try {
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      const payload = {
        name: form.name,
        campaign_type: form.format,
        status: "draft",
        bid_type: form.pricing,
        bid_amount: form.pricing === "cpa" ? parseFloat(form.cpaGoal || "0") : 0.05,
        daily_limit: parseFloat(form.dailyBudget || "10.0"),
        total_budget: parseFloat(form.totalBudget || "0"),
        target_countries: form.countries,
        target_devices: form.devices,
        target_os: form.os,
        target_browsers: form.browsers,
        landing_url: form.targetUrl,
        form_data: form
      };

      let res;
      if (editingId) {
        res = await fetch(`${API_BASE}/api/advertiser/campaigns/${editingId}`, {
          method: "PUT",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE}/api/advertiser/campaigns`, {
          method: "POST",
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        pushNotification(`Draft "${form.name}" saved.`);
        setErrors({});
        setEditingId(null);
        setForm({
          name: "", format: "popunder", pricing: "cpa", targetUrl: "",
          traffic: "all", countries: ["US", "CA", "GB", "DE"], bids: { US: 1.5, CA: 1.3, GB: 1.3, DE: 1.2 },
          budgetMode: "daily", dailyBudget: "", totalBudget: "", cpaGoal: "",
          alertEnabled: false, alertThreshold: "",
          devices: ["mobile"], os: ["Android"], browsers: [], browserLanguages: [], connection: "All", vpn: "all",
          retarget: "none", autoStart: true, quality: false, timezone: "UTC",
          zoneMode: "include", zones: "",
        });
        await fetchInitialData();
        setView("offers");
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to save draft");
      }
    } catch (err) {
      console.error("Save draft error:", err);
      alert("An error occurred while saving draft");
    } finally {
      setSavingDraft(false);
    }
  };

  // Open a saved offer (typically a draft) back into the builder for editing.
  const editOffer = (id: any) => {
    const o = offers.find((x) => x.id === id);
    if (!o) return;
    
    setForm({
      name: o.name || "",
      format: o.format || "popunder",
      pricing: o.pricing || "cpa",
      targetUrl: o.targetUrl || "",
      traffic: o.traffic || "all",
      countries: o.countries || [],
      bids: o.bids || { US: 1.5, CA: 1.3, GB: 1.3, DE: 1.2 },
      budgetMode: o.budgetMode || "daily",
      dailyBudget: o.dailyBudget || "",
      totalBudget: o.totalBudget || "",
      cpaGoal: o.cpaGoal || "",
      alertEnabled: o.alertEnabled || false,
      alertThreshold: o.alertThreshold || "",
      devices: o.devices || ["mobile"],
      os: o.os || ["Android"],
      browsers: o.browsers || [],
      browserLanguages: o.browserLanguages || [],
      connection: o.connection || "All",
      vpn: o.vpn || "all",
      retarget: o.retarget || "none",
      autoStart: o.autoStart !== undefined ? o.autoStart : true,
      quality: o.quality || false,
      timezone: o.timezone || "UTC",
      zoneMode: o.zoneMode || "include",
      zones: o.zones || "",
    });
    setEditingId(id);
    setErrors({});
    setView("builder");
  };

  // Approve campaign status
  const approveOffer = async (id: any) => {
    try {
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/advertiser/campaigns/${id}/status`, {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: "running" })
      });

      if (res.ok) {
        const o = offers.find((x) => x.id === id);
        pushNotification(`"${o?.name || "Campaign"}" was approved and is now live.`);
        await fetchInitialData();
      }
    } catch (err) {
      console.error("Approve campaign error:", err);
    }
  };

  // Discard a draft.
  const deleteOffer = async (id: any) => {
    try {
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/advertiser/campaigns/${id}`, {
        method: "DELETE",
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        pushNotification("Campaign deleted.");
        if (editingId === id) setEditingId(null);
        await fetchInitialData();
      }
    } catch (err) {
      console.error("Delete campaign error:", err);
    }
  };

  // Wallet Deposit handler
  const handleDeposit = async (amount: number) => {
    try {
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/advertiser/deposit`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ amount })
      });

      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        pushNotification(`Deposited $${amount.toFixed(2)} to your wallet.`);
        setView("builder");
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to deposit funds");
      }
    } catch (err) {
      console.error("Deposit error:", err);
      alert("An error occurred while depositing funds");
    }
  };

  const MAIN_NAV = [
    { id: "builder", label: "Campaign Builder", Icon: Megaphone },
    { id: "campaigns", label: "Campaigns", Icon: Layers },
    { id: "offers", label: "My Offers & Stats", Icon: TrendingUp },
    { id: "deposit", label: "Wallet", Icon: Wallet },
    { id: "notes", label: "Implementation Notes", Icon: Info },
  ];

  useEffect(() => {
    if (view !== "builder") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 }
    );
    Object.values(refMap.current).forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [view]);

  const jump = (id) => refMap.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Layout collapse state
  const [subOpen, setSubOpen] = useState(true);       // sub-sidebar (campaign steps)
  const [summaryOpen, setSummaryOpen] = useState(true); // right-hand live summary
  const [railHover, setRailHover] = useState(null);     // which rail icon is hovered (for label tooltip)

  // ---- Product tour ----
  const [tourOn, setTourOn] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourRect, setTourRect] = useState(null);

  const startTour = () => { setView("builder"); setSubOpen(true); setSummaryOpen(true); setTourStep(0); setTourOn(true); };
  const endTour = () => setTourOn(false);

  // Load the Archivo font once (tight, corporate-editorial).
  useEffect(() => {
    if (document.getElementById("ml-archivo-font")) return;
    const link = document.createElement("link");
    link.id = "ml-archivo-font";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&display=swap";
    document.head.appendChild(link);
  }, []);

  // Auto-start once per session (artifacts can't persist across reloads)
  useEffect(() => {
    const seen = (window as any).__ml_tour_seen;
    if (!seen) { (window as any).__ml_tour_seen = true; const id = setTimeout(() => startTour(), 700); return () => clearTimeout(id); }
  }, []);

  // Drive the tour: ensure prerequisites, scroll target into view, then measure.
  useEffect(() => {
    if (!tourOn) return;
    const stepDef = TOUR_STEPS[tourStep];
    if (!stepDef) return;
    // make sure panels needed are open
    if (stepDef.sel.includes('"steps"') || stepDef.sel.includes('sec-')) setSubOpen(true);
    if (stepDef.sel.includes('"summary"') || stepDef.sel.includes('"submit"')) setSummaryOpen(true);

    let tries = 0;
    const locate = () => {
      const el = document.querySelector(stepDef.sel);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        // measure after the scroll settles
        setTimeout(() => {
          const r = el.getBoundingClientRect();
          setTourRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }, 280);
      } else if (tries < 10) {
        tries++; setTimeout(locate, 80);
      }
    };
    locate();
  }, [tourOn, tourStep]);

  // keep highlight aligned on resize/scroll while the tour is open
  useEffect(() => {
    if (!tourOn) return;
    const reflow = () => {
      const el = document.querySelector(TOUR_STEPS[tourStep]?.sel);
      if (el) { const r = el.getBoundingClientRect(); setTourRect({ top: r.top, left: r.left, width: r.width, height: r.height }); }
    };
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => { window.removeEventListener("resize", reflow); window.removeEventListener("scroll", reflow, true); };
  }, [tourOn, tourStep]);

  const tourNext = () => { if (tourStep >= TOUR_STEPS.length - 1) endTour(); else setTourStep((s) => s + 1); };
  const tourPrev = () => setTourStep((s) => Math.max(0, s - 1));

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%", background: t.bgGrad, color: t.text, fontFamily: "'Archivo',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", fontSize: 14 }}>

      {/* ============ MAIN AREA ============ */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {view === "deposit" && (
          <DepositPage
            t={t}
            onBack={() => setView("builder")}
            balance={balance}
            onDeposit={handleDeposit}
            onPaypalSuccess={(newBalance: number, amount: number) => {
              setBalance(newBalance);
              pushNotification(`Deposited $${amount.toFixed(2)} via PayPal.`);
              setView("builder");
            }}
          />
        )}
        {view === "offers" && (
          <OffersPage t={t} offers={offers} onApprove={approveOffer} onNewCampaign={() => { setEditingId(null); setView("builder"); }} onEdit={editOffer} onDelete={deleteOffer} />
        )}
        {view === "reports" && (
          <AdvertiserReportsPage t={t} />
        )}
        {view === "notes" && <ImplementationNotesPage t={t} />}
        {view === "campaigns" && <CampaignsPage t={t} offers={offers} onRefresh={fetchInitialData} />}
        {view === "postback" && (
          <PostbackPage
            t={t}
            onBack={() => setView("builder")}
            pushNotification={pushNotification}
          />
        )}
        {view === "builder" && (
          <BuilderPage
            t={t} form={form} set={set} refMap={refMap} active={active} jump={jump}
            balance={balance} onAddFunds={() => setView("deposit")} onSubmitOffer={submitOffer}
            toggleCountry={toggleCountry} errors={errors} submitting={submitting}
            onSaveDraft={saveDraft} savingDraft={savingDraft} editingId={editingId}
            notifications={notifications} unreadCount={unreadCount} onMarkAllRead={markAllRead}
            subOpen={subOpen} setSubOpen={setSubOpen} summaryOpen={summaryOpen} setSummaryOpen={setSummaryOpen}
            dark={dark} setDark={setDark}
          />
        )}
      </div>

      {tourOn && (
        <Tour
          t={t}
          step={tourStep}
          total={TOUR_STEPS.length}
          rect={tourRect}
          side={TOUR_STEPS[tourStep]?.side}
          title={TOUR_STEPS[tourStep]?.title}
          body={TOUR_STEPS[tourStep]?.body}
          onNext={tourNext}
          onPrev={tourPrev}
          onClose={endTour}
        />
      )}
    </div>
  );
}

/* ====================================================================
   BUILDER PAGE
   ==================================================================== */
function BuilderPage({ t, form, set, refMap, active, jump, balance, onAddFunds, onSubmitOffer, toggleCountry, errors, submitting, onSaveDraft, savingDraft, editingId, notifications, unreadCount, onMarkAllRead, subOpen, setSubOpen, summaryOpen, setSummaryOpen, dark, setDark }: any) {
  const fmt = AD_FORMATS.find((f) => f.id === form.format);
  const [mapperExpanded, setMapperExpanded] = useState(true);
  
  // Calculate country score dynamically (up to 4 countries count towards full completion of the country step)
  const countriesScore = Math.min(1.0, form.countries.length * 0.25);
  
  const baseFilled = [
    form.name ? 1 : 0,
    form.targetUrl ? 1 : 0,
    (form.budgetMode === "unlimited" || form.dailyBudget || form.totalBudget) ? 1 : 0,
    form.devices.length > 0 ? 1 : 0,
    form.quality ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const progress = Math.round(((baseFilled + countriesScore) / 6) * 100);

  // map each section to a short label for the sub-sidebar
  const SHORT: any = { main: "Main", traffic: "Traffic", countries: "Countries", budget: "Budget", targeting: "Targeting", retargeting: "Retarget", schedule: "Schedule" };

  // Helper to parse parameter names for our macros from the target URL
  const parseUrlParams = (url: string) => {
    const params = {
      click_id: "",
      sub1: "",
      country: "",
      device_type: "",
      payout: ""
    };
    if (!url) return params;
    try {
      // If no query string, return empty
      const qIndex = url.indexOf("?");
      if (qIndex === -1) return params;
      
      const searchParams = new URLSearchParams(url.substring(qIndex + 1));
      for (const [key, val] of searchParams.entries()) {
        if (val === "{click_id}") params.click_id = key;
        else if (val === "{sub1}") params.sub1 = key;
        else if (val === "{country}") params.country = key;
        else if (val === "{device_type}") params.device_type = key;
        else if (val === "{payout}") params.payout = key;
      }
    } catch (e) {
      // fallback manual regex parsing if URLSearchParams fails
      const matchClick = url.match(/[\?&]([^=]+)=\{click_id\}/);
      if (matchClick) params.click_id = matchClick[1];
      const matchSub1 = url.match(/[\?&]([^=]+)=\{sub1\}/);
      if (matchSub1) params.sub1 = matchSub1[1];
      const matchCountry = url.match(/[\?&]([^=]+)=\{country\}/);
      if (matchCountry) params.country = matchCountry[1];
      const matchDevice = url.match(/[\?&]([^=]+)=\{device_type\}/);
      if (matchDevice) params.device_type = matchDevice[1];
      const matchPayout = url.match(/[\?&]([^=]+)=\{payout\}/);
      if (matchPayout) params.payout = matchPayout[1];
    }
    return params;
  };

  // Helper to update the target URL with a custom parameter name mapping to our macro
  const updateUrlParam = (macroName: string, newParamName: string) => {
    let curUrl = form.targetUrl || "";
    let baseUrl = curUrl.split("?")[0] || "https://your-offer.com";
    
    let searchParams = new URLSearchParams();
    const qIndex = curUrl.indexOf("?");
    if (qIndex !== -1) {
      searchParams = new URLSearchParams(curUrl.substring(qIndex + 1));
    }
    
    // Remove any key that currently maps to this macro
    const macroToken = `{${macroName}}`;
    const keysToRemove: string[] = [];
    for (const [key, val] of searchParams.entries()) {
      if (val === macroToken) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => searchParams.delete(key));
    
    // Add new mapping if param name is not empty
    if (newParamName.trim()) {
      searchParams.set(newParamName.trim(), macroToken);
    }
    
    const qs = searchParams.toString();
    const decodedQs = qs
      .replace(/%7B/g, "{")
      .replace(/%7D/g, "}");
      
    set("targetUrl", decodedQs ? `${baseUrl}?${decodedQs}` : baseUrl);
  };


  return (
    <div style={{ display: "flex", flex: 1, minWidth: 0 }}>

      {/* ============ CENTER + SUMMARY COLUMN ============ */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>

        {/* compact toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderBottom: `1px solid ${t.border}`, background: t.glass, backdropFilter: "blur(14px)", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: -0.3, display: "flex", alignItems: "center", gap: 10 }}>
              Create campaign
              {editingId && (
                <span style={{ fontSize: 11, fontWeight: 700, color: t.amber, background: t.amberSoft, padding: "3px 9px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 5 }}>
                  <FileEdit size={12} /> Editing draft
                </span>
              )}
            </h1>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {form.budgetMode === "daily" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: t.textDim, padding: "7px 10px", borderRadius: 7, background: t.panel, border: `1px solid ${t.border}` }}>
                <Clock size={14} /> {form.timezone}
              </div>
            )}
            <button
              type="button"
              onClick={onAddFunds}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                fontWeight: 600,
                color: "#fff",
                padding: "7px 14px",
                borderRadius: 7,
                background: t.brand,
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <Plus size={13} /> Add fund
            </button>
            <button type="button" onClick={() => setSummaryOpen((v) => !v)} title={summaryOpen ? "Hide summary" : "Show summary"} style={{ width: 32, height: 32, borderRadius: 7, border: `1px solid ${summaryOpen ? t.brand : t.border}`, background: summaryOpen ? t.brandSoft : t.panel, color: summaryOpen ? t.brand : t.textDim, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PanelRightClose size={17} /></button>
          </div>
        </div>

        {/* Horizontal steps navigation */}
        <div data-tour="steps" style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 20px",
          borderBottom: `1px solid ${t.border}`, background: t.panel, flexShrink: 0,
          overflowX: "auto"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {SECTIONS.map((s, i) => {
              const on = active === s.id;
              return (
                <button key={s.id} type="button" onClick={() => jump(s.id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, border: "none",
                  background: on ? t.brandSoft : "transparent", cursor: "pointer",
                  color: on ? t.brand : t.textDim, fontWeight: on ? 700 : 500, fontSize: 13, transition: "all .12s",
                }}>
                  <s.Icon size={14} />
                  <span>{SHORT[s.id]}</span>
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* Progress display */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: t.textDim }}>
              <span>Setup Progress:</span>
              <span style={{ fontWeight: 700, color: t.text }}>{progress}%</span>
              <div style={{ width: 80, height: 6, borderRadius: 99, background: t.panelAlt, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${progress}%`, background: t.brandGrad, borderRadius: 99, transition: "width .3s" }} />
              </div>
            </div>
          </div>
        </div>

        {/* scroll region: form + summary side by side */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", gap: 16, padding: "18px 20px 60px", alignItems: "flex-start" }}>
          <main style={{ flex: 1, minWidth: 0 }}>
          <Block t={t} id="main" n="1" refMap={refMap} title="Campaign basics" sub="Name it, choose the ad format, and how you pay.">
            <div style={{ marginBottom: 22 }}>
              <FieldLabel t={t}>Campaign name</FieldLabel>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. US/CA/UK/DE — Popunder CPA Sign-Up" style={{ ...inputStyle(t), border: `1px solid ${errors.name ? t.red : t.border}` }} />
              {errors.name && <div style={{ fontSize: 12, color: t.red, marginTop: 6 }}>{errors.name}</div>}
            </div>
             <div style={{ marginBottom: 24 }}>
               <FieldLabel t={t} hint="Where users land after clicking. Map your tracking parameters below.">Target URL</FieldLabel>
               <input value={form.targetUrl} onChange={(e) => set("targetUrl", e.target.value)} placeholder="https://your-offer.com/?clickid={click_id}" style={{ ...inputStyle(t), border: `1px solid ${errors.targetUrl ? t.red : t.border}` }} />
               {errors.targetUrl
                 ? <div style={{ fontSize: 12, color: t.red, marginTop: 6 }}>{errors.targetUrl}</div>
                 : <div style={{ fontSize: 12, color: t.textFaint, marginTop: 6 }}>Map tracking parameters so that conversion clicks can be correctly tracked back to your tracker.</div>}
               
               {/* Parameter Mapping Blocks */}
               <div style={{ marginTop: 16, border: `1px solid ${t.border}`, borderRadius: 8, padding: 14, background: t.panelAlt }}>
                 <div 
                   onClick={() => setMapperExpanded(!mapperExpanded)}
                   style={{ fontSize: 13, fontWeight: 700, color: t.text, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", userSelect: "none" }}
                 >
                   <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                     <Link size={14} color={t.brand} /> Tracking Parameter Builder
                   </div>
                   <div style={{ display: "flex", alignItems: "center", gap: 4, color: t.textDim, fontSize: 12 }}>
                     {mapperExpanded ? "Collapse" : "Expand"}
                     <ChevronDown 
                       size={15} 
                       style={{ 
                         transform: mapperExpanded ? "rotate(180deg)" : "rotate(0deg)", 
                         transition: "transform 0.2s" 
                       }} 
                     />
                   </div>
                 </div>

                 {!mapperExpanded && (
                   <div style={{ marginTop: 10, padding: 10, background: t.panel, borderRadius: 6, border: `1px solid ${t.border}` }}>
                     <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, marginBottom: 5 }}>Created Link Preview:</div>
                     <code style={{ fontSize: 11.5, wordBreak: "break-all", color: t.brand, display: "block", fontFamily: "monospace", padding: "6px 10px", background: t.panelAlt, borderRadius: 4, border: `1px solid ${t.border}` }}>
                       {form.targetUrl || "No target URL set"}
                     </code>
                   </div>
                 )}

                 {mapperExpanded && (
                   <div style={{ marginTop: 12 }}>
                     <div style={{ fontSize: 11.5, color: t.textDim, marginBottom: 12, lineHeight: "1.4" }}>
                       Enter the parameter name your tracking system expects on the left. We will automatically append it to your Target URL with our correct macro on the right.
                     </div>
                     
                     <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 8 }}>
                       {[
                         { label: "Click ID", macro: "click_id", desc: "Passes our unique click identifier (Required for S2S conversions)", required: true },
                         { label: "Sub ID 1", macro: "sub1", desc: "Passes publisher side sub-ids or extra click parameters", required: false },
                         { label: "Country", macro: "country", desc: "Passes user country (e.g. US, GB)", required: false },
                         { label: "Device", macro: "device_type", desc: "Passes device type (mobile, desktop, tablet)", required: false },
                         { label: "Payout", macro: "payout", desc: "Passes offer payout value", required: false }
                       ].map((item) => {
                         const parsedParams = parseUrlParams(form.targetUrl);
                         const currentValue = parsedParams[item.macro as keyof typeof parsedParams] || "";
                         
                         return (
                           <div key={item.macro} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "8px 12px", background: t.panel, border: `1px solid ${t.border}`, borderRadius: 6 }}>
                             <div style={{ flex: "1 1 200px" }}>
                               <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                                 {item.label} {item.required && <span style={{ color: t.red }}>*</span>}
                               </span>
                               <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 1 }}>{item.desc}</div>
                             </div>
                             <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "0 0 auto" }}>
                               <input 
                                 type="text" 
                                 value={currentValue}
                                 onChange={(e) => updateUrlParam(item.macro, e.target.value)}
                                 placeholder={item.required ? "e.g. click_id" : "optional param name"}
                                 style={{ 
                                   width: 140, 
                                   fontSize: 11.5, 
                                   padding: "6px 8px", 
                                   borderRadius: 4, 
                                   border: `1px solid ${t.border}`, 
                                   background: t.panelAlt,
                                   color: t.text 
                                 }} 
                               />
                               <span style={{ fontSize: 12, color: t.textDim, fontWeight: 500 }}>=</span>
                               <code style={{ fontSize: 11, background: t.panelAlt, padding: "4px 8px", borderRadius: 4, border: `1px solid ${t.border}`, color: t.brand, fontWeight: 600 }}>
                                 {`{${item.macro}}`}
                               </code>
                             </div>
                           </div>
                         );
                       })}
                     </div>

                     <button
                       type="button"
                       onClick={() => setMapperExpanded(false)}
                       style={{
                         width: "100%",
                         padding: "8px 12px",
                         borderRadius: 6,
                         border: "none",
                         background: t.brandGrad,
                         color: "#fff",
                         fontWeight: 700,
                         fontSize: 12.5,
                         cursor: "pointer",
                         display: "flex",
                         alignItems: "center",
                         justifyContent: "center",
                         gap: 6,
                         marginTop: 12,
                         boxShadow: t.glow
                       }}
                     >
                       <Check size={14} /> Save Mappings & Collapse
                     </button>
                   </div>
                 )}
               </div>
             </div>
            <FieldLabel t={t}>Ad format — what kind of ad to run</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
              {AD_FORMATS.map((f) => (
                <SelectCard key={f.id} t={t} active={form.format === f.id} onClick={() => set("format", f.id)} Icon={f.Icon} title={f.name} desc={f.desc} tag={f.tag} />
              ))}
            </div>
            <FieldLabel t={t} hint="How you're billed.">Pricing model</FieldLabel>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {PRICING.map((p) => (
                <SelectCard key={p.id} t={t} active={form.pricing === p.id} onClick={() => set("pricing", p.id)} Icon={p.Icon} title={p.name} desc={p.desc} foot={p.note} tag={p.recommend ? "Recommended" : null} tagColor={t.green} />
              ))}
            </div>
          </Block>

          <Block t={t} id="traffic" n="2" refMap={refMap} title="Traffic sources" sub="Choose the inventory your ads run on.">
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 22 }}>
              {TRAFFIC_TYPES.map((tr) => {
                const on = form.traffic === tr.id;
                const locked = tr.locked;
                return (
                  <button key={tr.id} type="button" disabled={locked} onClick={() => !locked && set("traffic", tr.id)} style={{
                    display: "flex", alignItems: "center", gap: 13, textAlign: "left", padding: 15, borderRadius: 6, cursor: locked ? "not-allowed" : "pointer",
                    border: `2px solid ${on ? t.brand : t.border}`, background: on ? t.brandSoft : t.panel,
                    opacity: locked ? 0.62 : 1, position: "relative"
                  }}>
                    <Radio t={t} active={on} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{tr.name}</div><div style={{ fontSize: 12.5, color: t.textDim, marginTop: 2 }}>{tr.desc}</div></div>
                    {locked && (
                      <Tooltip t={t} text={tr.lockNote}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: t.textDim, background: t.panelAlt, padding: "4px 9px", borderRadius: 4, cursor: "help" }}>
                          <Lock size={12} /> Admin
                        </span>
                      </Tooltip>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ background: t.panelAlt, borderRadius: 6, padding: 16 }}>
              <FieldLabel t={t} hint="Restrict to known zones.">Individual zones (optional)</FieldLabel>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Toggle active={form.zoneMode === "include"} onClick={() => set("zoneMode", "include")} t={t}>Include</Toggle>
                <Toggle active={form.zoneMode === "exclude"} onClick={() => set("zoneMode", "exclude")} t={t}>Exclude</Toggle>
              </div>
              <textarea 
                value={form.zones || ""} 
                onChange={(e) => set("zones", e.target.value)} 
                placeholder="Zone IDs separated by comma" 
                rows={2} 
                style={{ ...inputStyle(t), resize: "vertical" }} 
              />
              <div style={{ fontSize: 12, color: t.textFaint, marginTop: 6 }}>Maximum 5000 zones allowed.</div>
              {errors.zones && <div style={{ fontSize: 12.5, color: t.red, fontWeight: 600, marginTop: 6 }}>{errors.zones}</div>}
            </div>
          </Block>

          <Block t={t} id="countries" n="3" refMap={refMap} title="Countries" sub="Search and add the geos you want to target. Bidding and payouts are handled on our side.">
            <CountrySelect t={t} selected={form.countries} onToggle={toggleCountry} />
            {form.countries.length > 0 ? (
              <div style={{ border: `1px solid ${t.border}`, borderRadius: 6, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 16px", background: t.panelAlt, fontSize: 12, fontWeight: 700, color: t.textDim }}>
                  <span>Selected countries</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 13, color: t.brand }}>
                    <Check size={14} /> {form.countries.length} selected
                  </span>
                </div>
                {form.countries.map((code) => {
                  const c = COUNTRIES.find((x) => x.code === code);
                  return (
                    <div key={code} style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderTop: `1px solid ${t.border}` }}>
                      <div style={{ flex: 1, fontWeight: 700 }}>{c.flag} {c.name}</div>
                      <button type="button" onClick={() => toggleCountry(code)} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: t.textDim, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 5, padding: "5px 10px", cursor: "pointer" }}>
                        <X size={12} /> Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : <div style={{ padding: 30, textAlign: "center", color: t.textFaint, border: `1px dashed ${errors.countries ? t.red : t.border}`, borderRadius: 6 }}>Select at least one country.</div>}
            {errors.countries && <div style={{ fontSize: 12, color: t.red, marginTop: 8 }}>{errors.countries}</div>}
          </Block>

          <Block t={t} id="budget" n="4" refMap={refMap} title="Advertising budget" sub="Set what you pay per result and how much this campaign can spend.">
            {form.pricing === "cpa" && (
              <div style={{ marginBottom: 22 }}>
                <FieldLabel t={t} hint="Your price per conversion — what you'll be charged each time a lead/result completes. Confirmed by our team when your campaign is approved.">Your rate per conversion ($)</FieldLabel>
                <input type="number" value={form.cpaGoal} onChange={(e) => set("cpaGoal", e.target.value)} placeholder="1.50" style={{ ...inputStyle(t), border: `1px solid ${errors.cpaGoal ? t.red : t.border}` }} />
                {errors.cpaGoal
                  ? <div style={{ fontSize: 12, color: t.red, marginTop: 6 }}>{errors.cpaGoal}</div>
                  : <div style={{ fontSize: 12, color: t.textFaint, marginTop: 6 }}>You're billed this amount per completion. e.g. at $1.50, 150 conversions = $225 spent.</div>}
              </div>
            )}
            <FieldLabel t={t}>Budget limit</FieldLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              <Toggle active={form.budgetMode === "daily"} onClick={() => set("budgetMode", "daily")} t={t}>Daily</Toggle>
              <Toggle active={form.budgetMode === "total"} onClick={() => set("budgetMode", "total")} t={t}>Total</Toggle>
              <Toggle active={form.budgetMode === "unlimited"} onClick={() => set("budgetMode", "unlimited")} t={t}>Unlimited</Toggle>
            </div>
            {form.budgetMode === "daily" && (
              <div style={{ marginBottom: 22 }}>
                <FieldLabel t={t}>Daily spend cap ($)</FieldLabel>
                <input type="number" value={form.dailyBudget} onChange={(e) => set("dailyBudget", e.target.value)} placeholder="50.00" style={{ ...inputStyle(t), border: `1px solid ${errors.dailyBudget ? t.red : t.border}` }} />
                {errors.dailyBudget && <div style={{ fontSize: 12, color: t.red, marginTop: 6 }}>{errors.dailyBudget}</div>}
                <div style={{ marginTop: 14 }}>
                  <FieldLabel t={t} hint="The daily cap resets at midnight in this timezone — this controls when your daily budget refreshes.">Daily reset timezone</FieldLabel>
                  <div style={{ position: "relative" }}>
                    <select value={form.timezone} onChange={(e) => set("timezone", e.target.value)} style={{ ...inputStyle(t), appearance: "none", cursor: "pointer", paddingRight: 36 }}>
                      {TIMEZONES.map((tz) => <option key={tz.id} value={tz.id}>{tz.label}</option>)}
                    </select>
                    <ChevronDown size={15} color={t.textFaint} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
                  </div>
                  <div style={{ fontSize: 12, color: t.textFaint, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <Clock size={12} /> Your daily cap of ${form.dailyBudget || "0.00"} resets at 00:00 {form.timezone}.
                  </div>
                </div>
              </div>
            )}
            {form.budgetMode === "total" && (
              <div style={{ marginBottom: 22 }}>
                <FieldLabel t={t}>Total budget ($)</FieldLabel>
                <input type="number" value={form.totalBudget} onChange={(e) => set("totalBudget", e.target.value)} placeholder="500.00" style={{ ...inputStyle(t), border: `1px solid ${errors.totalBudget ? t.red : t.border}` }} />
                {errors.totalBudget && <div style={{ fontSize: 12, color: t.red, marginTop: 6 }}>{errors.totalBudget}</div>}
              </div>
            )}
            {form.budgetMode !== "unlimited" && (
              <div style={{ marginBottom: 22, border: `1px solid ${t.border}`, borderRadius: 6, padding: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="checkbox" checked={form.alertEnabled} onChange={(e) => set("alertEnabled", e.target.checked)} style={{ width: 17, height: 17, accentColor: t.brand }} />
                  <Bell size={15} color={t.textDim} />
                  <span style={{ fontWeight: 700, fontSize: 13.5 }}>Notify me when spend reaches a threshold</span>
                </label>
                {form.alertEnabled && (
                  <div style={{ marginTop: 12 }}>
                    <FieldLabel t={t} hint="We'll send a notification (and email, once notifications are wired up server-side) when this campaign's spend crosses this amount.">Alert threshold ($)</FieldLabel>
                    <input type="number" value={form.alertThreshold} onChange={(e) => set("alertThreshold", e.target.value)} placeholder="40.00" style={inputStyle(t)} />
                  </div>
                )}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 13, padding: 16, borderRadius: 6, background: balance < 50 ? t.amberSoft : t.greenSoft, border: `1px solid ${(balance < 50 ? t.amber : t.green)}33` }}>
              <Wallet size={22} color={balance < 50 ? t.amber : t.green} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Balance: ${balance.toFixed(2)}</div>
                <div style={{ fontSize: 12.5, color: t.textDim, marginTop: 2 }}>{balance < 50 ? "Add funds before launching — campaigns pause at $0." : "Funded and ready to launch."}</div>
              </div>
              <button type="button" onClick={onAddFunds} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", borderRadius: 6, border: "none", background: t.brandGrad, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: t.shadowSm }}><Plus size={16} /> Add funds</button>
            </div>
          </Block>

          <Block t={t} id="targeting" n="5" refMap={refMap} title="Targeting" sub="Narrow who sees the ads. Empty group = everyone.">
            <FieldLabel t={t}>Devices</FieldLabel>
            <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
              {[{ id: "mobile", name: "Mobile", Icon: Smartphone }, { id: "desktop", name: "Desktop", Icon: Monitor }, { id: "tablet", name: "Tablet", Icon: Tablet }].map((d) => {
                const on = form.devices.includes(d.id);
                return (
                  <button type="button" key={d.id} onClick={() => set("devices", on ? form.devices.filter((x) => x !== d.id) : [...form.devices, d.id])} style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "17px 10px", borderRadius: 6, cursor: "pointer",
                    border: `2px solid ${on ? t.brand : t.border}`, background: on ? t.brandSoft : t.panel, color: on ? t.brand : t.textDim, fontWeight: 600, fontSize: 13.5
                  }}><d.Icon size={22} /> {d.name}</button>
                );
              })}
            </div>
            <FieldLabel t={t}>Operating system</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              {OS_LIST.map((o) => <Chip key={o} active={form.os.includes(o)} t={t} onClick={() => set("os", form.os.includes(o) ? form.os.filter((x) => x !== o) : [...form.os, o])}>{o}</Chip>)}
            </div>
            <FieldLabel t={t}>Browser</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              {BROWSERS.map((b) => <Chip key={b} active={form.browsers.includes(b)} t={t} onClick={() => set("browsers", form.browsers.includes(b) ? form.browsers.filter((x) => x !== b) : [...form.browsers, b])}>{b}</Chip>)}
            </div>
            <FieldLabel t={t} hint="Target users by the language their browser is set to — useful for matching creative/landing page language to the audience.">Browser language</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              {BROWSER_LANGUAGES.map((l) => <Chip key={l} active={form.browserLanguages.includes(l)} t={t} onClick={() => set("browserLanguages", form.browserLanguages.includes(l) ? form.browserLanguages.filter((x) => x !== l) : [...form.browserLanguages, l])}>{l}</Chip>)}
            </div>
            <FieldLabel t={t}>Connection</FieldLabel>
            <div style={{ display: "flex", gap: 8, marginBottom: 22 }}>{CONNECTION.map((c) => <Toggle key={c} active={form.connection === c} onClick={() => set("connection", c)} t={t}>{c}</Toggle>)}</div>
            <FieldLabel t={t} hint="Excluding VPN/proxy traffic helps keep conversions clean for CPA campaigns — most networks recommend No VPN for performance offers.">VPN traffic</FieldLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ id: "all", label: "All traffic" }, { id: "no_vpn", label: "No VPN" }, { id: "only_vpn", label: "Only VPN" }].map((o) => (
                <Toggle key={o.id} active={form.vpn === o.id} onClick={() => set("vpn", o.id)} t={t}>{o.label}</Toggle>
              ))}
            </div>
          </Block>

          <Block t={t} id="retargeting" n="6" refMap={refMap} title="Audience for retargeting" sub="Build an audience from this campaign to re-engage later.">
            <div style={{ display: "flex", flexDirection: "column", gap: 11, marginBottom: 18 }}>
              {[
                { id: "none", title: "Do not collect", desc: "No retargeting audience." },
                { id: "converted", title: "Collect users who completed conversions", desc: "Retarget converters & upsell. S2S required.", locked: true, lockNote: "Admin-controlled — retargeting audiences are configured by our team on request, not self-serve." },
              ].map((o) => {
                const on = form.retarget === o.id;
                const locked = o.locked;
                return (
                  <button key={o.id} type="button" disabled={locked} onClick={() => !locked && set("retarget", o.id)} style={{ display: "flex", gap: 13, alignItems: "flex-start", textAlign: "left", padding: 15, borderRadius: 6, cursor: locked ? "not-allowed" : "pointer", border: `2px solid ${on ? t.brand : t.border}`, background: on ? t.brandSoft : t.panel, opacity: locked ? 0.62 : 1 }}>
                    <Radio t={t} active={on} />
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{o.title}</div><div style={{ fontSize: 12.5, color: t.textDim, marginTop: 3 }}>{o.desc}</div></div>
                    {locked && (
                      <Tooltip t={t} text={o.lockNote}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: t.textDim, background: t.panelAlt, padding: "4px 9px", borderRadius: 4, cursor: "help", flexShrink: 0 }}>
                          <Lock size={12} /> Admin
                        </span>
                      </Tooltip>
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 10, padding: 15, background: t.brandSoft, borderRadius: 6 }}>
              <Info size={18} color={t.brand} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55 }}>Retarget users who completed a conversion (S2S required) and make upsells.</div>
            </div>
          </Block>

          <Block t={t} id="schedule" n="7" refMap={refMap} title="Launch & compliance" sub="Your campaign goes live as soon as it's approved.">
            <label style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={form.autoStart} onChange={(e) => set("autoStart", e.target.checked)} style={{ width: 18, height: 18, accentColor: t.brand }} />
              <span style={{ fontWeight: 600 }}>Automatically start after moderation <span style={{ color: t.textDim, fontWeight: 400 }}>(up to 24 hours)</span></span>
            </label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "12px 0", cursor: "pointer" }}>
              <input type="checkbox" checked={form.quality} onChange={(e) => set("quality", e.target.checked)} style={{ width: 18, height: 18, accentColor: t.brand, marginTop: 2 }} />
              <span style={{ fontWeight: 600 }}>I declare my campaign meets the <span style={{ color: t.brand }}>Quality Guidelines</span></span>
            </label>
            {errors.quality && <div style={{ fontSize: 12, color: t.red, marginTop: -6, marginBottom: 6 }}>{errors.quality}</div>}
            {form.pricing === "cpa" && (
              <div style={{ display: "flex", gap: 11, padding: 15, background: t.amberSoft, borderRadius: 6, marginTop: 12 }}>
                <Info size={18} color={t.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: t.text, lineHeight: 1.55 }}>Conversion tracking must be set up to activate the CPA Goal model.</div>
              </div>
            )}
          </Block>
          </main>

          {summaryOpen && (
            <LiveSummary t={t} form={form} fmt={fmt} progress={progress} balance={balance} onAddFunds={onAddFunds} onSubmitOffer={onSubmitOffer} onClose={() => setSummaryOpen(false)} submitting={submitting} errors={errors} onSaveDraft={onSaveDraft} savingDraft={savingDraft} editingId={editingId} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================
   LIVE SUMMARY
   ==================================================================== */
function LiveSummary({ t, form, fmt, progress, balance, onAddFunds, onSubmitOffer, onClose, submitting, errors, onSaveDraft, savingDraft, editingId }: any) {
  const price = PRICING.find((p) => p.id === form.pricing);
  const ready = form.quality;
  const hasErrors = errors && Object.keys(errors).length > 0;

  const Row = ({ label, value, accent }: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${t.border}`, gap: 12 }}>
      <span style={{ fontSize: 12.5, color: t.textDim }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 700, textAlign: "right", color: accent || t.text, maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );

  return (
    <div data-tour="summary" style={{ width: 300, flexShrink: 0, position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ borderRadius: 12, overflow: "hidden", boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
        <div style={{ background: t.brandGrad, padding: "16px 18px", color: "#fff", position: "relative" }}>
          <button type="button" onClick={onClose} title="Hide summary" style={{ position: "absolute", top: 12, right: 12, width: 24, height: 24, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.18)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={14} /></button>
          <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85 }}>Summary</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, letterSpacing: -0.2, minHeight: 20, opacity: form.name ? 1 : 0.55, paddingRight: 28 }}>{form.name || "Untitled campaign"}</div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, opacity: 0.85, marginBottom: 5 }}><span>Setup progress</span><span style={{ fontWeight: 600 }}>{progress}%</span></div>
            <div style={{ height: 6, borderRadius: 99, background: "rgba(255,255,255,0.25)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progress}%`, background: "#fff", borderRadius: 99, transition: "width .3s" }} />
            </div>
          </div>
        </div>
        <div style={{ background: t.panel, padding: "12px 16px" }}>
          <Row label="Ad format" value={fmt.name} />
          <Row label="Pricing" value={price.name} accent={t.brand} />
          <Row label="Countries" value={form.countries.length ? `${form.countries.length} selected` : "None"} />
          <Row label="Devices" value={form.devices.length ? form.devices.join(", ") : "All"} />
          {form.vpn !== "all" && <Row label="VPN traffic" value={form.vpn === "no_vpn" ? "No VPN" : "Only VPN"} />}
          {form.alertEnabled && form.alertThreshold && <Row label="Spend alert" value={`at $${form.alertThreshold}`} />}
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12, padding: "9px 11px", borderRadius: 6, background: balance < 50 ? t.amberSoft : t.greenSoft }}>
            <Wallet size={16} color={balance < 50 ? t.amber : t.green} />
            <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>Balance ${balance.toFixed(2)}</span>
            <button type="button" onClick={onAddFunds} style={{ fontSize: 12, fontWeight: 600, color: t.brand, background: "none", border: "none", cursor: "pointer" }}>Top up</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" onClick={onSaveDraft} disabled={savingDraft || submitting} style={{
              flex: 1, padding: "11px", borderRadius: 8, border: `1px solid ${t.border}`,
              background: t.panel, color: t.text, fontWeight: 700, fontSize: 13.5,
              cursor: (savingDraft || submitting) ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              opacity: (savingDraft || submitting) ? 0.6 : 1,
            }}>
              {savingDraft
                ? <><span style={{ width: 13, height: 13, borderRadius: "50%", border: `2px solid ${t.border}`, borderTopColor: t.textDim, animation: "spin .7s linear infinite" }} /> Saving…</>
                : <><FileEdit size={15} /> Save as Draft</>}
            </button>
            <button type="button" data-tour="submit" disabled={!ready || submitting} onClick={onSubmitOffer} style={{
              flex: 1.4, padding: "11px", borderRadius: 8, border: "none",
              background: (ready && !submitting) ? t.brandGrad : t.border, color: "#fff", fontWeight: 700, fontSize: 14.5,
              cursor: (ready && !submitting) ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              boxShadow: (ready && !submitting) ? t.glow : "none", transition: "all .15s"
            }}>
              {submitting
                ? <><span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", animation: "spin .7s linear infinite" }} /> Submitting…</>
                : <><ShieldCheck size={17} /> Submit Campaign</>}
            </button>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          {ready && !hasErrors && !submitting && <div style={{ fontSize: 11.5, color: t.textFaint, textAlign: "center", marginTop: 8 }}>We'll review it before it goes live (usually within 24h).</div>}
          {!ready && <div style={{ fontSize: 11.5, color: t.textFaint, textAlign: "center", marginTop: 8 }}>Accept Quality Guidelines to submit, or save as a draft anytime.</div>}
          {ready && hasErrors && <div style={{ fontSize: 11.5, color: t.red, textAlign: "center", marginTop: 8 }}>Fix the highlighted fields before submitting</div>}
        </div>
      </div>

      <div style={{ borderRadius: 8, padding: 16, background: t.panel, border: `1px solid ${t.border}`, boxShadow: t.shadowSm }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={16} color={t.brand} />
          <div style={{ fontWeight: 600, fontSize: 14 }}>Launch with AI</div>
        </div>
        <div style={{ fontSize: 12.5, color: t.textDim, marginTop: 5, lineHeight: 1.5 }}>Let the assistant pick formats and geos for your offer.</div>
        <button type="button" style={{ marginTop: 11, width: "100%", padding: "9px", borderRadius: 6, border: `1px solid ${t.brand}`, background: t.panel, color: t.brand, fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Start AI assistant</button>
      </div>
    </div>
  );
}

/* ====================================================================
   DEPOSIT PAGE
   ==================================================================== */
function DepositPage({ t, onBack, balance, onDeposit, onPaypalSuccess }: any) {
  const [method, setMethod] = useState("card");
  const [amount, setAmount] = useState("");
  const [paypalLoaded, setPaypalLoaded] = useState(false);
  const [paypalError, setPaypalError] = useState(false);
  const [cardBtnEligible, setCardBtnEligible] = useState(true);
  const [paypalMode, setPaypalMode] = useState("sandbox");
  const [txid, setTxid] = useState("");
  const [copied, setCopied] = useState(false);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  // Subtab and transaction history states
  const [subtab, setSubtab] = useState("deposit");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const fetchTransactions = async () => {
    setLoadingTransactions(true);
    try {
      const token = localStorage.getItem('advertiser_token');
      const res = await fetch(`${API_BASE}/api/advertiser/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoadingTransactions(false);
    }
  };

  useEffect(() => {
    if (subtab === "history") {
      fetchTransactions();
    }
  }, [subtab]);

  const presets = [70, 200, 500, 1000, 2000];
  const sel = PAYMENT_METHODS.find((m) => m.id === method) as any;
  const depositAmount = Number(amount) || 0;
  const valid = depositAmount >= (sel?.min || 0);

  // Fee calculation
  let feePercent = 0;
  if (method === "usdt") {
    feePercent = depositAmount < 1000 ? 3 : 0;
  } else if (method === "paypal" || method === "card") {
    if (depositAmount < 1000) feePercent = 7;
    else if (depositAmount < 2000) feePercent = 3;
    else feePercent = 2;
  }
  const feeAmount = depositAmount * (feePercent / 100);

  // Bonus calculation (only for USDT)
  let bonusPercent = 0;
  if (method === "usdt") {
    if (depositAmount >= 2000) bonusPercent = 20;
    else if (depositAmount >= 1000) bonusPercent = 7;
  }
  const bonusAmount = depositAmount * (bonusPercent / 100);

  const youPay = depositAmount + feeAmount;
  const creditedToBalance = depositAmount + bonusAmount;
  const amt = depositAmount; // baseline for UI display

  const handleCopy = () => {
    if (sel && sel.address) {
      navigator.clipboard.writeText(sel.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleManualDeposit = async () => {
    if (!valid || !txid.trim()) return;
    setManualSubmitting(true);
    try {
      const token = localStorage.getItem('advertiser_token');
      const res = await fetch(`${API_BASE}/api/advertiser/deposit/manual`, {
        method: "POST",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: creditedToBalance,
          deposit_amount: depositAmount,
          charge_amount: youPay,
          fee: feeAmount,
          bonus: bonusAmount,
          method: method,
          txid: txid.trim()
        })
      });
      if (res.ok) {
        alert("Deposit request submitted successfully! Your balance will update once verified by the admin.");
        onBack();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to submit deposit request");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting deposit request.");
    } finally {
      setManualSubmitting(false);
    }
  };

  useEffect(() => {
    if ((method !== "paypal" && method !== "card") || !valid) return;

    const loadPaypalSdk = async () => {
      let clientId = "sb";
      try {
        const token = localStorage.getItem('advertiser_token');
        const res = await fetch(`${API_BASE}/api/advertiser/paypal/config`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const config = await res.json();
          clientId = config.clientId;
          setPaypalMode(config.mode || "sandbox");
        }
      } catch (err) {
        console.error("Failed to fetch PayPal config, using fallback client ID:", err);
      }

      const scriptId = "paypal-checkout-sdk";
      let script = document.getElementById(scriptId) as HTMLScriptElement;

      const renderButtons = () => {
        const paypalObj = (window as any).paypal;
        if (!paypalObj) {
          setPaypalError(true);
          return;
        }
        
        const container = document.getElementById("paypal-button-container");
        if (!container) return;
        container.innerHTML = ""; // Clear existing buttons
        
        const isCard = method === "card";
        
        const makeOptions = (src?: any) => {
          const opt: any = {
            style: {
              layout: 'vertical',
              color:  src === paypalObj.FUNDING.CARD ? "black" : "gold",
              shape:  'rect',
              label:  src === paypalObj.FUNDING.CARD ? "credit" : "paypal"
            },
            createOrder: async () => {
              try {
                const token = localStorage.getItem('advertiser_token');
                const res = await fetch(`${API_BASE}/api/advertiser/paypal/create-order`, {
                  method: "POST",
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ amount: youPay })
                });
                if (!res.ok) throw new Error("Failed to create order");
                const order = await res.json();
                return order.id;
              } catch (err) {
                console.error(err);
                return `MOCK-PAYPAL-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
              }
            },
            onApprove: async (data: any, actions: any) => {
              try {
                const token = localStorage.getItem('advertiser_token');
                const res = await fetch(`${API_BASE}/api/advertiser/paypal/capture-order`, {
                  method: "POST",
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({ orderID: data.orderID, amount: creditedToBalance, charge_amount: youPay })
                });
                if (!res.ok) throw new Error("Capture failed");
                const result = await res.json();
                onPaypalSuccess(result.balance, creditedToBalance);
              } catch (err) {
                console.error(err);
                alert("Payment completed successfully!");
                onDeposit(creditedToBalance);
              }
            },
            onError: (err: any) => {
              console.error("Payment error:", err);
              alert("An error occurred during payment.");
            }
          };
          if (src) opt.fundingSource = src;
          return opt;
        };

        if (isCard) {
          try {
            const cardBtn = paypalObj.Buttons(makeOptions(paypalObj.FUNDING.CARD));
            if (cardBtn.isEligible()) {
              setCardBtnEligible(true);
              cardBtn.render("#paypal-button-container");
              return;
            }
          } catch (e) {
            console.error("Error rendering card button:", e);
          }

          setCardBtnEligible(false);
          console.warn("Card buttons not eligible/supported, rendering standard PayPal checkout buttons.");
          try {
            const fallbackBtn = paypalObj.Buttons(makeOptions(paypalObj.FUNDING.PAYPAL));
            fallbackBtn.render("#paypal-button-container");
          } catch (err) {
            console.error("Fallback render failed:", err);
          }
        } else {
          setCardBtnEligible(true);
          try {
            const paypalBtn = paypalObj.Buttons(makeOptions(paypalObj.FUNDING.PAYPAL));
            paypalBtn.render("#paypal-button-container");
          } catch (err) {
            console.error("PayPal render failed:", err);
          }
        }
      };

      if (!script) {
        script = document.createElement("script");
        script.id = scriptId;
        script.src = `https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD`;
        script.async = true;
        script.onload = () => {
          setPaypalLoaded(true);
          renderButtons();
        };
        script.onerror = () => {
          setPaypalError(true);
        };
        document.body.appendChild(script);
      } else {
        if ((window as any).paypal) {
          renderButtons();
        }
      }
    };

    loadPaypalSdk();
  }, [method, amt, valid]);

  return (
    <div style={{ width: "100%", padding: "24px 24px 60px", boxSizing: "border-box" }}>
      <button type="button" onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: t.textDim, cursor: "pointer", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
        <X size={16} /> Back to campaign
      </button>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>Add funds</h1>
      <p style={{ fontSize: 13.5, color: t.textDim, margin: "5px 0 22px" }}>Current balance ${balance.toFixed(2)}. Top up to fund your campaigns. {paypalMode !== 'live' && "Demo only — no real charge is made."}</p>

      {/* Subtabs for Billing */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: `1px solid ${t.border}`, paddingBottom: 0 }}>
        <button
          type="button"
          onClick={() => setSubtab("deposit")}
          style={{
            background: "none",
            border: "none",
            borderBottom: `2px solid ${subtab === "deposit" ? t.brand : "transparent"}`,
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            color: subtab === "deposit" ? t.brand : t.textDim,
            transition: "all 0.15s",
            outline: "none"
          }}
        >
          Top Up
        </button>
        <button
          type="button"
          onClick={() => setSubtab("history")}
          style={{
            background: "none",
            border: "none",
            borderBottom: `2px solid ${subtab === "history" ? t.brand : "transparent"}`,
            padding: "8px 16px",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            color: subtab === "history" ? t.brand : t.textDim,
            transition: "all 0.15s",
            outline: "none"
          }}
        >
          Payment History
        </button>
      </div>

      {subtab === "deposit" ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 16, alignItems: "start" }}>
          <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, padding: 20, boxShadow: t.shadowSm }}>
            <FieldLabel t={t}>Payment method</FieldLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
              {PAYMENT_METHODS.map((m) => {
                const on = method === m.id;
                return (
                  <button type="button" key={m.id} disabled={m.disabled} onClick={() => !m.disabled && setMethod(m.id)} style={{
                    display: "flex", alignItems: "center", gap: 12, textAlign: "left", padding: "11px 13px", borderRadius: 6, cursor: m.disabled ? "not-allowed" : "pointer",
                    border: `${on ? 2 : 1}px solid ${on ? t.brand : t.border}`, background: on ? t.brandSoft : t.panel,
                    opacity: m.disabled ? 0.55 : 1,
                  }}>
                    <div style={{ width: 34, height: 34, borderRadius: 6, background: on ? t.brandSoft : t.panelAlt, color: on ? t.brand : t.textDim, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><m.Icon size={18} /></div>
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: 14 }}>{m.name}</div><div style={{ fontSize: 12, color: t.textDim, marginTop: 1 }}>{m.desc}</div></div>
                    {m.badge && <span style={{ fontSize: 11, fontWeight: 600, color: m.disabled ? t.amber : t.green, background: m.disabled ? t.amberSoft : t.greenSoft, padding: "2px 8px", borderRadius: 4, flexShrink: 0 }}>{m.badge}</span>}
                    {!m.disabled && <Radio t={t} active={on} />}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ position: "sticky", top: 78, borderRadius: 12, overflow: "hidden", boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
            <div style={{ background: t.brandGrad, padding: "16px 18px", color: "#fff" }}>
              <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85 }}>You're adding</div>
              <div style={{ fontSize: 28, fontWeight: 700, marginTop: 3, letterSpacing: -0.5 }}>${amt.toFixed(2)}</div>
            </div>
            <div style={{ background: t.panel, padding: 16 }}>
              <FieldLabel t={t}>Amount (USD)</FieldLabel>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={{ ...inputStyle(t), fontSize: 20, fontWeight: 700, padding: "11px 13px" }} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7, margin: "12px 0 16px" }}>
                {presets.map((p) => (
                  <button type="button" key={p} onClick={() => setAmount(String(p))} style={{ flex: "1 1 28%", padding: "8px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 13, border: `1px solid ${amt === p ? t.brand : t.border}`, background: amt === p ? t.brandSoft : t.panelAlt, color: amt === p ? t.brand : t.textDim }}>${p}</button>
                ))}
              </div>

              {depositAmount <= 0 ? (
                <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: t.textDim }}>
                    <span>Method</span>
                    <span style={{ color: t.text, fontWeight: 700 }}>{sel?.name || method}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: t.textDim }}>
                    <span>Fee</span>
                    <span style={{ color: t.textDim, fontWeight: 500 }}>Enter amount</span>
                  </div>
                </div>
              ) : (
                <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14, fontSize: 13 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: t.textDim }}>
                    <span>Method</span>
                    <span style={{ color: t.text, fontWeight: 700 }}>{sel?.name || method}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: t.textDim }}>
                    <span>Deposit</span>
                    <span style={{ color: t.text, fontWeight: 700 }}>${depositAmount.toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: t.textDim }}>
                    <span>Fee ({feePercent}%)</span>
                    <span style={{ color: feeAmount > 0 ? "#ef4444" : t.text, fontWeight: 700 }}>
                      {feeAmount > 0 ? `+$${feeAmount.toFixed(2)}` : `$${feeAmount.toFixed(2)}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: t.textDim }}>
                    <span>You pay</span>
                    <span style={{ color: t.text, fontWeight: 700 }}>${youPay.toFixed(2)}</span>
                  </div>
                  {bonusAmount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, color: t.textDim }}>
                      <span>Bonus credit ({bonusPercent}%)</span>
                      <span style={{ color: "#10b981", fontWeight: 700 }}>+${bonusAmount.toFixed(2)}</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, borderTop: `1px dashed ${t.border}`, paddingTop: 12, color: t.textDim }}>
                    <span style={{ fontWeight: 600 }}>Credited to balance</span>
                    <span style={{ color: "#10b981", fontWeight: 800, fontSize: 14.5 }}>${creditedToBalance.toFixed(2)}</span>
                  </div>
                  
                  <div style={{ marginTop: 14, padding: "10px 12px", borderRadius: 6, background: t.panelAlt, border: `1px solid ${t.border}`, fontSize: 12, lineHeight: 1.4, color: t.textDim }}>
                    {method === "usdt" && feePercent === 0 ? (
                      `No fee. You'll be charged $${depositAmount.toFixed(2)} and, with the ${bonusPercent}% bonus, $${creditedToBalance.toFixed(2)} is credited to your balance.`
                    ) : (
                      `A ${feePercent}% fee ($${feeAmount.toFixed(2)}) is added on top — you'll be charged $${youPay.toFixed(2)}, and $${depositAmount.toFixed(2)} is credited to your balance.`
                    )}
                  </div>
                </div>
              )}
              {!valid && amount && <div style={{ fontSize: 12.5, color: t.red, marginTop: 8 }}>Minimum for {sel?.name || method} is ${sel?.min || 0}.</div>}
              
              {method === "usdt" && (
                <div style={{ marginTop: 16, borderTop: `1px solid ${t.border}`, paddingTop: 16 }}>
                  <div style={{
                    background: t.panelAlt,
                    border: `1px solid ${t.border}`,
                    borderRadius: 12,
                    padding: "20px 18px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    textAlign: "center"
                  }}>
                    {/* Step 1 */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                        1. Send USDT to this address
                      </div>
                      <div
                        onClick={handleCopy}
                        title="Click to copy address"
                        style={{
                          cursor: "pointer",
                          padding: "14px 10px",
                          background: t.panel,
                          border: `1px dashed ${t.border}`,
                          borderRadius: 8,
                          position: "relative",
                          transition: "background 0.2s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = t.brandSoft)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = t.panel)}
                      >
                        <span style={{
                          fontFamily: "monospace",
                          fontSize: 15,
                          fontWeight: 700,
                          letterSpacing: "0.5px",
                          wordBreak: "break-all",
                          color: t.text
                        }}>
                          {sel?.address}
                        </span>
                        {copied && (
                          <span style={{
                            position: "absolute",
                            right: 10,
                            fontSize: 10,
                            color: "#10b981",
                            fontWeight: 700,
                            background: t.panel,
                            padding: "2px 6px",
                            borderRadius: 4,
                            border: `1px solid ${t.border}`
                          }}>
                            Copied!
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: t.textDim, marginTop: 10, lineHeight: "1.5" }}>
                        After sending, paste your transaction ID below. Your balance is credited once the transfer is confirmed on-chain (no live gateway yet).
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: t.textDim, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                        2. Transaction ID (TXID / hash)
                      </div>
                      <input
                        type="text"
                        value={txid}
                        onChange={(e) => setTxid(e.target.value)}
                        placeholder="e.g. 0x9f3c.. or TRON tx hash"
                        style={{
                          ...inputStyle(t),
                          textAlign: "center",
                          background: t.panel,
                          fontSize: 13.5
                        }}
                      />
                      {!txid.trim() && (
                        <div style={{ fontSize: 12, color: "#d97706", marginTop: 8, fontWeight: 500 }}>
                          Paste your transaction ID to submit the deposit.
                        </div>
                      )}
                    </div>

                    {/* Submit Button */}
                    <button
                      type="button"
                      disabled={!valid || !txid.trim() || manualSubmitting}
                      onClick={handleManualDeposit}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 8,
                        border: "none",
                        background: (!valid || !txid.trim()) ? (t.dark ? "#2d2f39" : "#e8eaf6") : t.brand,
                        color: (!valid || !txid.trim()) ? (t.dark ? "#5a5e72" : "#9fa8da") : "#fff",
                        fontWeight: 700,
                        fontSize: 14.5,
                        cursor: (!valid || !txid.trim() || manualSubmitting) ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 8,
                        transition: "background 0.2s"
                      }}
                    >
                      <FileText size={16} />
                      {manualSubmitting ? "Submitting..." : "Submit transaction"}
                    </button>
                  </div>
                </div>
              )}

              {method !== "usdt" && (
                valid ? (
                  <div style={{ marginTop: 16 }}>
                    <div id="paypal-button-container" style={{ minHeight: 45 }}></div>
                    {paypalError && (
                      <div style={{ color: t.red, fontSize: 12, marginTop: 8, textAlign: "center" }}>
                        Failed to load PayPal Buttons. Check your connection or ad-blocker.
                      </div>
                    )}
                  </div>
                ) : (
                  <button type="button" disabled style={{ width: "100%", marginTop: 16, padding: "12px", borderRadius: 8, border: "none", background: t.border, color: "#fff", fontWeight: 700, fontSize: 14.5, cursor: "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Wallet size={17} /> Deposit</button>
                )
              )}
              
              <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center", marginTop: 12, fontSize: 11.5, color: t.textFaint }}>
                <ShieldCheck size={13} />
                {method === "usdt" ? "Secured • demo environment" : "Secured • payment environment"}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: "20px 24px", boxShadow: t.shadowSm }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Transaction History</h2>
            <button
              type="button"
              onClick={fetchTransactions}
              style={{
                background: "none",
                border: `1px solid ${t.border}`,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                fontWeight: 600,
                color: t.text,
                cursor: "pointer"
              }}
            >
              Refresh
            </button>
          </div>

          {loadingTransactions ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: t.textDim }}>Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: t.textFaint, fontSize: 13.5 }}>
              No transactions found.
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${t.border}`, color: t.textDim, textAlign: "left" }}>
                    <th style={{ padding: "12px 8px", fontWeight: 600 }}>Date</th>
                    <th style={{ padding: "12px 8px", fontWeight: 600 }}>Method</th>
                    <th style={{ padding: "12px 8px", fontWeight: 600 }}>TXID / Ref</th>
                    <th style={{ padding: "12px 8px", fontWeight: 600 }}>Status</th>
                    <th style={{ padding: "12px 8px", fontWeight: 600, textAlign: "right" }}>Amount Added</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any) => {
                    const isPending = tx.status === "pending";
                    const isConfirmed = tx.status === "confirmed" || tx.status === "completed" || tx.status === "approved";
                    const dateStr = tx.created_at ? new Date(tx.created_at).toLocaleString() : "N/A";
                    
                    let methodLabel = tx.method ? tx.method.toUpperCase() : "N/A";
                    if (tx.method === "usdt") methodLabel = "USDT (TRC20)";
                    if (tx.method === "card") methodLabel = "Credit / Debit Card";
                    if (tx.method === "paypal") methodLabel = "PayPal";

                    return (
                      <tr key={tx.id} style={{ borderBottom: `1px solid ${t.border}`, transition: "background 0.15s" }}>
                        <td style={{ padding: "12px 8px", color: t.text }}>{dateStr}</td>
                        <td style={{ padding: "12px 8px", fontWeight: 600, color: t.text }}>{methodLabel}</td>
                        <td style={{ padding: "12px 8px", fontFamily: "monospace", color: t.textDim, fontSize: 11.5 }}>
                          {tx.external_ref || "N/A"}
                        </td>
                        <td style={{ padding: "12px 8px" }}>
                          {isPending ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: 4 }}>
                              Pending
                            </span>
                          ) : isConfirmed ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "2px 8px", borderRadius: 4 }}>
                              Approved
                            </span>
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", background: "#fef2f2", border: "1px solid #fca5a5", padding: "2px 8px", borderRadius: 4 }}>
                              {tx.status || "Failed"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, fontSize: 14 }}>
                          {isConfirmed ? (
                            <span style={{ color: "#10b981" }}>+${tx.amount.toFixed(2)}</span>
                          ) : (
                            <span style={{ color: t.textDim }}>${tx.amount.toFixed(2)}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PREDEFINED_PARAMS = [
  { key: "user_id", label: "user_id (Publisher)" },
  { key: "sub1", label: "sub1 (End User)" },
  { key: "payout", label: "payout" },
  { key: "transaction_id", label: "transaction_id" },
  { key: "click_id", label: "click_id" },
  { key: "offer_id", label: "offer_id" },
  { key: "offer_name", label: "offer_name" },
  { key: "cid", label: "cid" },
  { key: "cname", label: "cname" },
  { key: "status", label: "status" },
  { key: "event_type", label: "event_type" },
  { key: "sub_id1", label: "sub_id1" },
  { key: "sub_id2", label: "sub_id2" },
  { key: "sub_id3", label: "sub_id3" },
  { key: "sub_id4", label: "sub_id4" },
  { key: "sub_id5", label: "sub_id5" },
  { key: "ip_address", label: "ip_address" },
  { key: "country", label: "country" },
  { key: "user_agent", label: "user_agent" }
];

function PostbackPage({ t, onBack, pushNotification }: any) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [testClickId, setTestClickId] = useState("test_click_" + Math.random().toString(36).substring(2, 8));
  const [testPayout, setTestPayout] = useState("1.50");
  const [testStatus, setTestStatus] = useState("lead");
  const [testResults, setTestResults] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Parameter Mapping States
  const [editingRows, setEditingRows] = useState<{ paramKey: string, macroName: string }[]>([]);
  const [localUrl, setLocalUrl] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const getUrlFromRows = (rows: { paramKey: string, macroName: string }[], uniqueKey: string) => {
    const base_url = `https://postback.moustacheleads.com/postback/${uniqueKey || 'key'}`;
    if (rows.length > 0) {
      const param_parts = rows.map(row => {
        const key = row.paramKey;
        const macro = row.macroName.trim() || key;
        return `${key}={${macro}}`;
      });
      return `${base_url}?${param_parts.join('&')}`;
    }
    return base_url;
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('advertiser_token');
        if (!token) return;
        const res = await fetch(`${API_BASE}/api/advertiser/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          const params = data.profile.postback_parameters || [];
          const maps = data.profile.postback_parameter_mappings || {};
          const rows = params.map((p: string) => ({
            paramKey: p,
            macroName: maps[p] || p
          }));
          setEditingRows(rows);
          setLocalUrl(getUrlFromRows(rows, data.profile.unique_postback_key));
        }
      } catch (err) {
        console.error("Error fetching postback profile:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addRow = () => {
    const unusedKey = PREDEFINED_PARAMS.find(p => !editingRows.some(r => r.paramKey === p.key))?.key || PREDEFINED_PARAMS[0].key;
    const newRows = [...editingRows, { paramKey: unusedKey, macroName: "" }];
    setEditingRows(newRows);
    setLocalUrl(getUrlFromRows(newRows, profile?.unique_postback_key));
  };

  const deleteRow = (index: number) => {
    const newRows = editingRows.filter((_, i) => i !== index);
    setEditingRows(newRows);
    setLocalUrl(getUrlFromRows(newRows, profile?.unique_postback_key));
  };

  const updateRowKey = (index: number, newKey: string) => {
    const newRows = editingRows.map((r, i) => i === index ? { ...r, paramKey: newKey } : r);
    setEditingRows(newRows);
    setLocalUrl(getUrlFromRows(newRows, profile?.unique_postback_key));
  };

  const updateRowMacro = (index: number, newVal: string) => {
    const newRows = editingRows.map((r, i) => i === index ? { ...r, macroName: newVal } : r);
    setEditingRows(newRows);
    setLocalUrl(getUrlFromRows(newRows, profile?.unique_postback_key));
  };

  const handleUrlInputChange = (val: string) => {
    setLocalUrl(val);
    try {
      const qIndex = val.indexOf('?');
      if (qIndex === -1) {
        setEditingRows([]);
        return;
      }
      const queryString = val.substring(qIndex + 1);
      if (!queryString.trim()) {
        setEditingRows([]);
        return;
      }
      const parts = queryString.split('&');
      const newRows: { paramKey: string, macroName: string }[] = [];
      
      parts.forEach(part => {
        const [rawKey, rawVal] = part.split('=');
        if (rawKey) {
          const key = decodeURIComponent(rawKey).trim();
          let macro = rawVal ? decodeURIComponent(rawVal).trim() : '';
          if (macro.startsWith('{') && macro.endsWith('}')) {
            macro = macro.substring(1, macro.length - 1);
          }
          newRows.push({ paramKey: key, macroName: macro });
        }
      });
      setEditingRows(newRows);
    } catch (err) {
      console.error("Error parsing URL on change:", err);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsSaving(true);
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      const parameters = editingRows.map(r => r.paramKey);
      const parameter_mappings: Record<string, string> = {};
      editingRows.forEach(r => {
        parameter_mappings[r.paramKey] = r.macroName.trim() || r.paramKey;
      });

      const res = await fetch(`${API_BASE}/api/advertiser/postback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          parameters,
          custom_params: [],
          parameter_mappings
        })
      });

      if (res.ok) {
        const data = await res.json();
        setProfile((prev: any) => ({
          ...prev,
          postback_receiver_url: data.full_url,
          postback_parameters: data.parameters,
          postback_parameter_mappings: data.parameter_mappings
        }));
        const savedRows = data.parameters.map((p: string) => ({
          paramKey: p,
          macroName: data.parameter_mappings[p] || p
        }));
        setEditingRows(savedRows);
        setLocalUrl(getUrlFromRows(savedRows, data.unique_postback_key || profile.unique_postback_key));
        if (pushNotification) {
          pushNotification("Postback configuration saved successfully!");
        } else {
          alert("Postback configuration saved successfully!");
        }
      } else {
        const errData = await res.json();
        alert(errData.error || "Failed to save postback configuration");
      }
    } catch (err: any) {
      console.error(err);
      alert("Error: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const getTestFireUrl = () => {
    if (!profile) return "";
    const uniqueKey = profile.unique_postback_key;
    const base_url = `https://postback.moustacheleads.com/postback/${uniqueKey}`;
    
    const replacements: Record<string, string> = {
      click_id: testClickId,
      payout: testPayout,
      status: testStatus,
      user_id: profile.user_id || "pub_12345",
      transaction_id: "tx_12345",
      offer_id: "off_99",
      offer_name: "test_offer",
      cid: "c_88",
      cname: "campaign_test",
      event_type: "registration",
      sub_id1: "s1",
      sub_id2: "s2",
      sub_id3: "s3",
      sub_id4: "s4",
      sub_id5: "s5",
      ip_address: "127.0.0.1",
      country: "US",
      user_agent: "Mozilla"
    };

    let fireUrl = localUrl || base_url;
    Object.entries(replacements).forEach(([key, val]) => {
      fireUrl = fireUrl.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    });
    return fireUrl;
  };

  const handleFireTestPostback = async () => {
    try {
      setTesting(true);
      setTestResults(null);
      
      const fireUrl = getTestFireUrl();
      const res = await fetch(fireUrl);
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      
      setTestResults({
        success: res.ok,
        data: data
      });
    } catch (err: any) {
      setTestResults({
        success: false,
        data: { error: err.message || "Failed to establish request link" }
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "300px", color: t.textDim }}>
        Loading postback configuration...
      </div>
    );
  }

  if (!profile || !profile.postback_receiver_url) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: t.textDim }}>
        <p style={{ fontSize: 16, marginBottom: 20 }}>Postback is not configured for your account yet.</p>
        <button
          type="button"
          onClick={onBack}
          style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: t.brand, color: "#fff", cursor: "pointer" }}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", padding: "24px 0px 60px", boxSizing: "border-box", color: t.text }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, borderBottom: `1px solid ${t.border}`, paddingBottom: 15 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Global Postback Configuration</h1>
          <p style={{ fontSize: 13.5, color: t.textDim, marginTop: 4 }}>Automatically notify your system of conversions generated on Moustache Leads</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.panel, color: t.text, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
        >
          Back to builder
        </button>
      </div>

      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: t.shadowSm }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, background: "#10b981", borderRadius: "50%", display: "inline-block" }}></span>
          Your Global Postback URL
        </h2>
        <p style={{ fontSize: 13, color: t.textDim, marginBottom: 16 }}>
          Set this URL as the postback destination in your tracking system (like HasOffers, Voluum, or your custom server).
        </p>

        <div style={{ display: "flex", gap: 10, background: t.bg, border: `1px solid ${t.border}`, padding: 12, borderRadius: 8 }}>
          <input
            type="text"
            value={localUrl}
            onChange={(e) => handleUrlInputChange(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", color: t.text, fontFamily: "monospace", fontSize: 13, outline: "none" }}
          />
          <button
            type="button"
            onClick={() => copyToClipboard(localUrl)}
            style={{ background: t.brandSoft, color: t.brand, border: "none", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontWeight: 600, fontSize: 12.5 }}
          >
            {copied ? "Copied!" : "Copy URL"}
          </button>
        </div>

        <div style={{ marginTop: 20, padding: 15, background: t.bg, borderRadius: 8, borderLeft: `4px solid ${t.brand}` }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: t.brand, display: "block", marginBottom: 4 }}>Security Key</span>
          <code style={{ fontSize: 12.5, color: t.textDim, wordBreak: "break-all" }}>{profile.unique_postback_key}</code>
        </div>
      </div>

      {/* Active Parameter Mapping Section */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, boxShadow: t.shadowSm, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Active Parameter Mapping</h2>
            <p style={{ fontSize: 13, color: t.textDim, marginTop: 4 }}>
              Define the parameters you want to receive and map them to your tracker macros.
            </p>
          </div>
          <button
            type="button"
            onClick={addRow}
            style={{ padding: "6px 12px", background: t.brandSoft, color: t.brand, border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
          >
            <span style={{ fontSize: 14 }}>+</span> Add Parameter
          </button>
        </div>

        {editingRows.length === 0 ? (
          <div style={{ padding: "20px 0", textAlign: "center", color: t.textDim, fontSize: 13, fontStyle: "italic", border: `1px dashed ${t.border}`, borderRadius: 8 }}>
            No parameter mappings configured. Click "+ Add Parameter" to start.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 4 }}>
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: t.textDim }}>Our Parameter</div>
              <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: t.textDim }}>Advertiser Parameter</div>
              <div style={{ width: 80 }}></div>
            </div>
            {editingRows.map((row, index) => (
              <div key={index} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <select
                    value={row.paramKey}
                    onChange={(e) => updateRowKey(index, e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, color: t.text, outline: "none", fontSize: 13 }}
                  >
                    {PREDEFINED_PARAMS.map(p => (
                      <option key={p.key} value={p.key}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    placeholder="Their param name, e.g. sub1"
                    value={row.macroName}
                    onChange={(e) => updateRowMacro(index, e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, color: t.text, outline: "none", fontSize: 13 }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => deleteRow(index)}
                  style={{ width: 80, padding: "8px 0", background: "#fef2f2", border: "none", borderRadius: 6, color: "#ef4444", cursor: "pointer", fontSize: 13, fontWeight: 600, textAlign: "center" }}
                  title="Remove Parameter"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 24, borderTop: `1px solid ${t.border}`, paddingTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSaveSettings}
            style={{ padding: "10px 20px", background: t.brand, color: "#fff", border: "none", borderRadius: 8, cursor: isSaving ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13.5 }}
          >
            {isSaving ? "Saving Settings..." : "Save Mappings"}
          </button>
        </div>
      </div>

      {/* Test Conversion Section */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginTop: 24, boxShadow: t.shadowSm }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Test conversion</h2>
        <p style={{ fontSize: 13, color: t.textDim, marginBottom: 20 }}>
          Fire a test postback to confirm your setup before spending budget.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 15, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>Test click ID</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                value={testClickId}
                onChange={(e) => setTestClickId(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, color: t.text, outline: "none" }}
              />
              <button
                type="button"
                onClick={() => setTestClickId("test_click_" + Math.random().toString(36).substring(2, 8))}
                style={{ padding: "0 10px", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 6, color: t.text, cursor: "pointer" }}
                title="Generate random ID"
              >
                 
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>Goal / Status</label>
            <select
              value={testStatus}
              onChange={(e) => setTestStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: `1px solid ${t.border}`, background: t.bg, color: t.text, outline: "none" }}
            >
              <option value="lead">1 - Registration (Lead)</option>
              <option value="conversion">2 - First Deposit (FTD)</option>
              <option value="approved">3 - Purchase (Approved)</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12.5, fontWeight: 600, display: "block", marginBottom: 6 }}>Request that will fire</label>
          <div style={{ background: t.bg, border: `1px solid ${t.border}`, padding: 12, borderRadius: 8, fontFamily: "monospace", fontSize: 12, color: t.brand, wordBreak: "break-all" }}>
            GET: {getTestFireUrl()}
          </div>
        </div>

        <button
          type="button"
          disabled={testing}
          onClick={handleFireTestPostback}
          style={{ width: "100%", padding: "12px", background: t.brand, color: "#fff", border: "none", borderRadius: 8, cursor: testing ? "not-allowed" : "pointer", fontWeight: 700, transition: "background 0.2s" }}
        >
          {testing ? "Firing Test Conversion..." : "Fire test conversion"}
        </button>

        {testResults && (
          <div style={{ marginTop: 20, padding: 15, background: testResults.success ? "#f0fdf4" : "#fef2f2", border: `1px solid ${testResults.success ? "#bbf7d0" : "#fecaca"}`, borderRadius: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: testResults.success ? "#166534" : "#991b1b", display: "block", marginBottom: 6 }}>
              {testResults.success ? "  Request completed successfully" : "  Request failed"}
            </span>
            <pre style={{ fontSize: 12, margin: 0, padding: 10, background: "#fff", border: `1px solid ${testResults.success ? "#dcfce7" : "#fee2e2"}`, borderRadius: 4, overflowX: "auto", fontFamily: "monospace", color: "#333" }}>
              {JSON.stringify(testResults.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================
   CAMPAIGNS PAGE — list of submitted campaigns with an
   Advertiser / Admin view toggle. Dummy data. No margin or publisher
   payout shown in EITHER view.
   ==================================================================== */
// Loaded dynamically from the database via offers prop

const FLAGS = { IN: "🇮🇳", BD: "🇧🇩", BR: "🇧🇷", US: "🇺🇸", CA: "🇨🇦", DE: "🇩🇪", GB: "🇬🇧", ID: "🇮🇩" };

function CampaignsPage({ t, offers = [], onRefresh }: any) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const role: string = "advertiser";
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setCampaigns(offers.map((o: any) => ({
      id: o.id,
      name: o.name,
      status: o.status,
      format: o.format || "Popunder",
      pricing: o.pricing || "CPA",
      rate: o.rate || parseFloat(o.cpaGoal || "1.5"),
      geos: o.countries || [],
      devices: Array.isArray(o.devices) ? o.devices.join(", ") : o.devices || "Mobile",
      completes: o.completes || (o.stats ? o.stats.conversions : 0) || 0,
      clicks: o.clicks || (o.stats ? o.stats.clicks : 0) || 0,
      spend: o.spend || (o.stats ? o.stats.spend : 0) || 0
    })));
  }, [offers]);

  const money = (n: any) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n: any) => n.toLocaleString("en-US");

  const statusMeta = (s: any) => ({
    running: { c: t.green, label: "Running", live: true },
    approved: { c: t.green, label: "Running", live: true },
    pending: { c: t.amber, label: "Pending", live: false },
    paused: { c: t.textDim, label: "Paused", live: false },
    rejected: { c: t.red, label: "Rejected", live: false },
  }[s] || { c: t.textDim, label: s, live: false });

  const Status = ({ s }: any) => {
    const m = statusMeta(s);
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: m.c, whiteSpace: "nowrap" }}>
        <span style={{ position: "relative", width: 7, height: 7, display: "inline-flex" }}>
          <span style={{ position: "absolute", inset: 0, borderRadius: 999, background: m.c }} />
          {m.live && <span style={{ position: "absolute", inset: -3, borderRadius: 999, background: m.c, opacity: 0.35, animation: "cpulse 1.6s ease-out infinite" }} />}
        </span>
        {m.label}
      </span>
    );
  };

  const setStatus = async (id: any, status: any) => {
    try {
      const token = localStorage.getItem('advertiser_token');
      if (!token) return;

      const res = await fetch(`${API_BASE}/api/advertiser/campaigns/${id}/status`, {
        method: "PUT",
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        if (onRefresh) await onRefresh();
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const counts: any = {
    all: campaigns.length,
    running: campaigns.filter((c) => c.status === "running").length,
    pending: campaigns.filter((c) => c.status === "pending").length,
  };
  const shown = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  // summary totals
  const totalSpend = campaigns.reduce((s, c) => s + c.spend, 0);
  const totalConv = campaigns.reduce((s, c) => s + c.completes, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.clicks, 0);

  const summary = (role === "advertiser"
    ? [
        { label: "Active campaigns", value: counts.running },
        { label: "Total completes", value: num(totalConv) },
        { label: "Total spend", value: money(totalSpend) },
      ]
    : [
        { label: "Campaigns", value: counts.all },
        { label: "Running", value: counts.running, accent: t.green },
        { label: "Pending review", value: counts.pending, accent: t.amber },
        { label: "Total spend", value: money(totalSpend) },
      ]) as any[];

  // column layout per role
  const advCols = "minmax(220px,1fr) 120px 120px 130px";
  const admCols = "minmax(200px,1.4fr) 110px 130px 70px 90px 90px 110px 70px 120px 150px";

  const headStyle = { fontSize: 11, fontWeight: 600, color: t.textFaint, textTransform: "uppercase" as const, letterSpacing: 0.4, padding: "0 14px", whiteSpace: "nowrap" } as React.CSSProperties;
  const cellStyle = { padding: "0 14px", display: "flex", alignItems: "center", minWidth: 0 } as React.CSSProperties;

  return (
    <div style={{ width: "100%", padding: "22px 24px 60px", boxSizing: "border-box" }}>
      <style>{`@keyframes cpulse { 0% { transform: scale(0.8); opacity: 0.5; } 100% { transform: scale(2.4); opacity: 0; } }`}</style>

      {/* header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 18 }}>
        <div>
          <h1 style={{ fontSize: 21, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>Campaigns</h1>
          <p style={{ fontSize: 13, color: t.textDim, margin: "3px 0 0" }}>
            {role === "advertiser" ? "Your submitted campaigns and live performance." : "Review and manage all advertiser campaigns."}
          </p>
        </div>
      </div>

      {/* summary stat bar */}
      <div style={{ display: "flex", border: `1px solid ${t.border}`, borderRadius: 8, background: t.panel, boxShadow: t.shadowSm, marginBottom: 14, overflow: "hidden" }}>
        {summary.map((s, i) => (
          <div key={s.label} style={{ flex: 1, padding: "13px 16px", borderLeft: i ? `1px solid ${t.border}` : "none" }}>
            <div style={{ fontSize: 11.5, color: t.textDim, fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, letterSpacing: -0.4, color: s.accent || t.text, fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* filter + count */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "inline-flex", gap: 2, background: t.panelAlt, border: `1px solid ${t.border}`, borderRadius: 7, padding: 2 }}>
          {[["all", "All"], ["running", "Running"], ["pending", "Pending"]].map(([k, lbl]) => (
            <button type="button" key={k} onClick={() => setFilter(k)} style={{
              padding: "5px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
              background: filter === k ? t.panel : "transparent", color: filter === k ? t.text : t.textFaint,
              boxShadow: filter === k ? t.shadowSm : "none",
            }}>{lbl} <span style={{ color: t.textFaint, fontWeight: 500 }}>{counts[k]}</span></button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: t.textFaint }}>{shown.length} {shown.length === 1 ? "campaign" : "campaigns"}</span>
      </div>

      {/* ============ DATA TABLE ============ */}
      <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, background: t.panel, boxShadow: t.shadowSm, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: role === "admin" ? 1180 : 600 }}>
            {/* header row */}
            <div style={{ display: "grid", gridTemplateColumns: role === "admin" ? admCols : advCols, alignItems: "center", height: 38, background: t.panelAlt, borderBottom: `1px solid ${t.border}` }}>
              {role === "advertiser" ? (
                <>
                  <div style={headStyle}>Campaign</div>
                  <div style={{ ...headStyle, textAlign: "right", justifySelf: "end" }}>Status</div>
                  <div style={{ ...headStyle, textAlign: "right", justifySelf: "end" }}>Completes</div>
                  <div style={{ ...headStyle, textAlign: "right", justifySelf: "end" }}>Spend</div>
                </>
              ) : (
                <>
                  <div style={headStyle}>Campaign</div>
                  <div style={headStyle}>Status</div>
                  <div style={headStyle}>Format</div>
                  <div style={{ ...headStyle, justifySelf: "end" }}>Rate</div>
                  <div style={headStyle}>Geo</div>
                  <div style={headStyle}>Device</div>
                  <div style={{ ...headStyle, justifySelf: "end" }}>Clicks</div>
                  <div style={{ ...headStyle, justifySelf: "end" }}>Conv.</div>
                  <div style={{ ...headStyle, justifySelf: "end" }}>Spend</div>
                  <div style={headStyle}>Action</div>
                </>
              )}
            </div>

            {/* rows */}
            {shown.map((c, idx) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: role === "admin" ? admCols : advCols, alignItems: "center", minHeight: 54, borderBottom: idx < shown.length - 1 ? `1px solid ${t.border}` : "none" }}>
                {/* name (both) */}
                <div style={cellStyle}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: t.textFaint, fontVariantNumeric: "tabular-nums" }}>{c.id}</div>
                  </div>
                </div>

                {role === "advertiser" ? (
                  <>
                    <div style={{ ...cellStyle, justifyContent: "flex-end" }}><Status s={c.status} /></div>
                    <div style={{ ...cellStyle, justifyContent: "flex-end", fontWeight: 600, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{num(c.completes)}</div>
                    <div style={{ ...cellStyle, justifyContent: "flex-end", fontWeight: 600, fontSize: 14, fontVariantNumeric: "tabular-nums" }}>{money(c.spend)}</div>
                  </>
                ) : (
                  <>
                    <div style={cellStyle}><Status s={c.status} /></div>
                    <div style={{ ...cellStyle, color: t.textDim, fontSize: 13 }}>{c.format}</div>
                    <div style={{ ...cellStyle, justifyContent: "flex-end", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>${c.rate.toFixed(2)}</div>
                    <div style={{ ...cellStyle, fontSize: 15 }}>{c.geos.map((g) => FLAGS[g] || g).join(" ")}</div>
                    <div style={{ ...cellStyle, color: t.textDim, fontSize: 13 }}>{c.devices}</div>
                    <div style={{ ...cellStyle, justifyContent: "flex-end", color: t.textDim, fontVariantNumeric: "tabular-nums" }}>{num(c.clicks)}</div>
                    <div style={{ ...cellStyle, justifyContent: "flex-end", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{num(c.completes)}</div>
                    <div style={{ ...cellStyle, justifyContent: "flex-end", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(c.spend)}</div>
                    <div style={cellStyle}>
                      {c.status === "pending" ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button type="button" onClick={() => setStatus(c.id, "running")} style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: t.green, border: "none", borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>Approve</button>
                          <button type="button" onClick={() => setStatus(c.id, "rejected")} style={{ fontSize: 12, fontWeight: 600, color: t.textDim, background: "transparent", border: `1px solid ${t.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>Reject</button>
                        </div>
                      ) : c.status === "running" ? (
                        <button type="button" onClick={() => setStatus(c.id, "paused")} style={{ fontSize: 12, fontWeight: 600, color: t.textDim, background: "transparent", border: `1px solid ${t.border}`, borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>Pause</button>
                      ) : c.status === "paused" ? (
                        <button type="button" onClick={() => setStatus(c.id, "running")} style={{ fontSize: 12, fontWeight: 600, color: t.brand, background: t.brandSoft, border: `1px solid ${t.brand}33`, borderRadius: 6, padding: "5px 11px", cursor: "pointer" }}>Resume</button>
                      ) : <span style={{ fontSize: 12, color: t.textFaint }}>—</span>}
                    </div>
                  </>
                )}
              </div>
            ))}

            {shown.length === 0 && (
              <div style={{ padding: 40, textAlign: "center", color: t.textFaint, fontSize: 13 }}>No campaigns in this filter.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OffersPage({ t, offers, onApprove, onNewCampaign, onEdit, onDelete }: any) {
  const fmtMoney = (n: any) => `$${Number(n).toFixed(2)}`;

  const STATUS_META: any = {
    draft: { label: "Draft", color: t.textDim, bg: t.panelAlt },
    pending: { label: "Pending", color: t.amber, bg: t.amberSoft },
    approved: { label: "Approved", color: t.green, bg: t.greenSoft },
    running: { label: "Approved", color: t.green, bg: t.greenSoft },
    paused: { label: "Paused", color: t.textDim, bg: t.panelAlt },
    rejected: { label: "Rejected", color: t.red, bg: t.redSoft },
  };
  const StatusBadge = ({ status }: any) => {
    const m = STATUS_META[status] || STATUS_META.pending;
    return (
      <span style={{ fontSize: 11.5, fontWeight: 700, padding: "4px 11px", borderRadius: 4, color: m.color, background: m.bg, textTransform: "capitalize" as const }}>
        {m.label}
      </span>
    );
  };

  return (
    <div style={{ width: "100%", padding: "24px 24px 60px", boxSizing: "border-box" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: -0.4 }}>Statistics</h1>
      <p style={{ fontSize: 13.5, color: t.textDim, margin: "5px 0 22px" }}>
        Drafts are saved privately and stay editable. Once you submit, a campaign lands here as <strong>Pending</strong> until our team reviews and approves it.
        Once approved, live stats (impressions, clicks, conversions, spend) appear on the card.
      </p>

      {offers.length === 0 ? (
        <div style={{ padding: 50, textAlign: "center", border: `1px dashed ${t.border}`, borderRadius: 8, color: t.textFaint }}>
          <div style={{ marginBottom: 12 }}>No offers submitted yet.</div>
          <button type="button" onClick={onNewCampaign} style={{ padding: "10px 18px", borderRadius: 6, border: "none", background: t.brandGrad, color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: "pointer", boxShadow: t.shadowSm }}>
            Build a campaign
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {offers.map((o) => {
            const fmtF = AD_FORMATS.find((f) => f.id === o.format);
            const priceF = PRICING.find((p) => p.id === o.pricing);
            return (
              <div key={o.id} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 8, padding: 20, boxShadow: t.shadowSm }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{o.name || "Untitled campaign"}</div>
                    <div style={{ fontSize: 12.5, color: t.textDim, marginTop: 4 }}>
                      {fmtF?.name} · {priceF?.name} · {o.countries.length} {o.countries.length === 1 ? "country" : "countries"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StatusBadge status={o.status} />
                    {o.status === "draft" && (
                      <>
                        <button type="button" onClick={() => onEdit(o.id)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: 9, border: `1px solid ${t.border}`, background: t.panelAlt, color: t.text, cursor: "pointer" }}>
                          <FileEdit size={13} /> Edit
                        </button>
                        <button type="button" onClick={() => onDelete(o.id)} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "7px 13px", borderRadius: 9, border: `1px solid ${t.border}`, background: "transparent", color: t.red, cursor: "pointer" }}>
                          <X size={13} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {o.status === "approved" ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginTop: 16 }}>
                    {[
                      ["Impressions", o.stats.impressions.toLocaleString()],
                      ["Clicks", o.stats.clicks.toLocaleString()],
                      ["Conversions", o.stats.conversions.toLocaleString()],
                      ["Spend", fmtMoney(o.stats.spend)],
                    ].map(([label, val]) => (
                      <div key={label} style={{ background: t.panelAlt, borderRadius: 6, padding: "12px 14px" }}>
                        <div style={{ fontSize: 11.5, color: t.textDim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{val}</div>
                      </div>
                    ))}
                  </div>
                ) : o.status === "draft" ? (
                  <div style={{ display: "flex", gap: 10, padding: 13, background: t.panelAlt, borderRadius: 6, marginTop: 16 }}>
                    <FileEdit size={16} color={t.textDim} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12.5, color: t.text, lineHeight: 1.5 }}>
                      Not submitted yet. Edit and click "Submit Campaign" when you're ready to go live.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 10, padding: 13, background: t.amberSoft, borderRadius: 6, marginTop: 16 }}>
                    <Info size={16} color={t.amber} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12.5, color: t.text, lineHeight: 1.5 }}>
                      Awaiting moderation. Stats will appear here once this offer is approved and goes live.
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ====================================================================
   IMPLEMENTATION NOTES PAGE
   ==================================================================== */
const IMPLEMENTATION_PHASES = [
  {
    id: 1,
    title: "Phase 1 — Dashboard integration & alignment",
    desc: "Wire this Campaign Builder UI into the existing advertiser dashboard at advertisers.moustacheleads.com (already built/deployed).",
    items: [
      { text: "Add this Campaign Builder page into the existing advertiser dashboard at advertisers.moustacheleads.com", status: "pending" },
      { text: "Align styling/theme (colors, fonts, spacing) with the existing dashboard so it doesn't feel like a separate app", status: "pending" },
      { text: "Hook up real advertiser auth/session so the builder knows which account is creating the offer", status: "discuss" },
      { text: "Connect real account balance to the Wallet display (currently a local demo value)", status: "discuss" },
    ],
  },
  {
    id: 2,
    title: "Phase 2 — Offer submission → admin dashboard",
    desc: "When an advertiser submits an offer (\"Send to moderation\"), it must land in our internal admin dashboard for review.",
    items: [
      { text: "On submit, create the offer record in the backend with status = pending", status: "pending" },
      { text: "Show new pending offers in the admin dashboard for review", status: "pending" },
      { text: "Admin approves/rejects from the admin dashboard (the \"Approve\" button in this UI is a placeholder for that — remove from advertiser-facing view)", status: "pending" },
      { text: "MANUAL FOR NOW: advertiser submits their rate per conversion + targeting; we create the real campaign in our ad network backend, and set the publisher payout = 70% of their rate (30% margin) per offer — advertiser never sees the payout or margin", status: "pending" },
      { text: "Per-offer margin override: default 30% but adjustable on the admin side based on traffic quality — not shown or editable by the advertiser", status: "pending" },
      { text: "Once we've set it up on our side, mark the offer Approved here and stats start showing", status: "discuss" },
    ],
  },
  {
    id: 3,
    title: "Phase 3 — Stats",
    desc: "Once an offer is approved and live, show real performance stats on the advertiser's 'My Offers & Stats' page.",
    items: [
      { text: "Connect impressions/clicks/conversions/spend to real tracking data (currently hardcoded demo numbers)", status: "pending" },
      { text: "Decide refresh frequency (real-time vs. periodic sync)", status: "discuss" },
      { text: "Add date-range filter for stats once data is live", status: "discuss" },
    ],
  },
  {
    id: 4,
    title: "Phase 4 — Payments",
    desc: "Get deposit methods functional for advertisers.",
    items: [
      { text: "PayPal: confirm — we already have a PayPal gateway, need to know if it's currently functional and can be plugged in here, or if it needs setup work first", status: "discuss" },
      { text: "USDT: no live gateway — just display our wallet address on the Wallet page; advertiser sends manually if they want to use it", status: "pending" },
      { text: "Manual USDT deposits: define process for confirming an on-chain transfer and crediting the advertiser's balance", status: "discuss" },
      { text: "Commission / money flow: advertiser deposit → billed at their rate per conversion → publisher paid 70% → platform keeps 30%. Model is decided (see Data model below); wiring the automatic wallet debit + publisher payout ledger is the remaining work.", status: "discuss" },
    ],
  },
];

const DATA_MODEL = {
  intro:
    "Below is the exact data this Campaign Builder produces, so the backend/DB can be aligned to it. " +
    "Field names match the form's state keys. Types are suggestions. 'Set by' marks whether the value " +
    "comes from the advertiser (self-serve) or is filled in by our team/admin after submission.",
  tables: [
    {
      name: "advertisers",
      note: "One row per advertiser account (already exists in the current dashboard — listed for FK reference).",
      cols: [
        ["id", "uuid / bigint PK", "Advertiser account id. FK target for offers & wallet."],
        ["company, contact_name, email, phone, website, country", "varchar", "Profile (already collected at signup/approval)."],
        ["status", "enum(pending, approved, rejected)", "Existing advertiser approval state."],
        ["balance_cents", "bigint", "Wallet balance in minor units. Source of the Wallet display. Debited as the offer spends."],
      ],
    },
    {
      name: "offers   (a.k.a. campaigns)",
      note: "One row per campaign. Created on 'Save as Draft' (status='draft') or 'Send to moderation' (status='pending'). A draft is editable and not visible to admin moderation until submitted.",
      cols: [
        ["id", "uuid / bigint PK", "Offer id (UI currently uses Date.now() as a stand-in)."],
        ["advertiser_id", "FK → advertisers.id", "Who created it (from auth/session — NOT a form field yet, must be attached server-side)."],
        ["name", "varchar(120)", "ADVERTISER. Campaign name. Required even for drafts so it's identifiable in My Offers."],
        ["target_url", "text", "ADVERTISER. Landing URL. Advertiser builds it with tracking macros from the palette: {CLICK_ID} (required for conversion tracking), {COUNTRY}, {DEVICE}, {OS}, {ZONE_ID}. Substitute real values at click time."],
        ["format", "enum(popunder, push, inpage, interstitial)", "ADVERTISER. Ad delivery format."],
        ["pricing", "enum(cpa, cpm)", "ADVERTISER. Billing model."],
        ["advertiser_rate_cents", "bigint, nullable", "ADVERTISER proposes / agreed. The price the advertiser pays per conversion (e.g. 150 = $1.50). This is what they're billed and all they ever see. Only for pricing=cpa."],
        ["publisher_payout_cents", "bigint, nullable", "ADMIN-ONLY. What the publisher earns per conversion. Default = 70% of advertiser_rate_cents. NEVER sent to or shown to the advertiser."],
        ["margin_pct", "smallint, default 30", "ADMIN-ONLY. Platform margin %. publisher_payout = advertiser_rate × (100 − margin_pct)/100. Editable per offer; default 30 (so publisher gets 70%)."],
        ["traffic_type", "enum(all, mainstream, member)", "ADVERTISER. NOTE: 'member' is locked in UI = admin-only; reject if submitted by advertiser."],
        ["budget_mode", "enum(daily, total, unlimited)", "ADVERTISER."],
        ["daily_budget_cents / total_budget_cents", "bigint, nullable", "ADVERTISER. One is used depending on budget_mode."],
        ["timezone", "varchar(32)", "ADVERTISER. Timezone the daily budget cap resets in (e.g. UTC, EST, PST, GMT, CET, IST, or advertiser's local browser timezone). Only meaningful when budget_mode='daily'."],
        ["alert_enabled", "boolean, default false", "ADVERTISER. If true, a notification fires when spend crosses alert_threshold_cents."],
        ["alert_threshold_cents", "bigint, nullable", "ADVERTISER. Spend amount that triggers the alert. Only relevant when alert_enabled=true and budget_mode != 'unlimited'."],
        ["connection", "enum(all, wifi, mobile)", "ADVERTISER."],
        ["retarget", "enum(none, converted)", "ADVERTISER. NOTE: 'converted' is locked = admin-configured; treat as request only."],
        ["auto_start", "boolean", "ADVERTISER. Start automatically after moderation (campaign goes live on approval)."],
        ["quality_ack", "boolean", "ADVERTISER. Quality-Guidelines acceptance — required true to submit (NOT required to save as draft)."],
        ["status", "enum(draft, pending, approved, rejected, paused)", "SYSTEM/ADMIN. 'draft' = saved but not submitted, advertiser-only, fully editable. 'pending' = submitted, awaiting moderation. Admin sets approved/rejected/paused."],
        ["created_at / updated_at", "timestamp", "SYSTEM."],
      ],
    },
    {
      name: "offer_countries",
      note: "Child rows of an offer — one per selected country. This is the searchable multi-select.",
      cols: [
        ["offer_id", "FK → offers.id", ""],
        ["country_code", "char(2)", "ADVERTISER. ISO code (US, IN, …)."],
        ["bid_cents", "bigint, nullable", "ADMIN. Optional per-country override of the publisher payout. NOT advertiser-editable. (UI shows demo bids; don't trust them.)"],
      ],
    },
    {
      name: "offer_targeting",
      note: "Multi-value targeting selections. Either array columns on offers, or a child table per type.",
      cols: [
        ["devices", "string[] (mobile, desktop, tablet)", "ADVERTISER."],
        ["os", "string[] (Android, iOS, Windows, macOS, Linux)", "ADVERTISER."],
        ["browsers", "string[] (Chrome, Safari, …)", "ADVERTISER. Empty = all."],
        ["browser_languages", "string[]", "ADVERTISER. Browser-language targeting (English, Spanish, …). Empty = all."],
        ["connection", "enum(All, Wi-Fi, Mobile)", "ADVERTISER."],
        ["vpn", "enum(all, no_vpn, only_vpn)", "ADVERTISER. Fraud/quality control — 'no_vpn' excludes VPN/proxy traffic, recommended for CPA."],
      ],
    },
    {
      name: "offer_stats",
      note: "Performance for an approved offer. ADVERTISER sees only the advertiser-visible columns; the rest are admin-only.",
      cols: [
        ["offer_id", "FK → offers.id", ""],
        ["conversions (completes)", "bigint", "ADVERTISER-VISIBLE. The completions the advertiser cares about."],
        ["clicks, conversion_rate", "bigint / numeric", "ADVERTISER-VISIBLE."],
        ["advertiser_spend_cents", "bigint", "ADVERTISER-VISIBLE. conversions × advertiser_rate_cents. This is what's deducted from their balance."],
        ["publisher_cost_cents", "bigint", "ADMIN-ONLY. conversions × publisher_payout_cents. NEVER returned in the advertiser's stats response."],
        ["platform_margin_cents", "bigint", "ADMIN-ONLY. advertiser_spend − publisher_cost. NEVER exposed to the advertiser."],
        ["period / captured_at", "date / timestamp", "SYSTEM. For date-range filtering + refresh cadence (TBD)."],
      ],
    },
    {
      name: "wallet_transactions",
      note: "Deposits and spend against the advertiser balance. Powers the Wallet page history.",
      cols: [
        ["id", "uuid PK", ""],
        ["advertiser_id", "FK → advertisers.id", ""],
        ["type", "enum(deposit, spend, adjustment)", ""],
        ["method", "enum(card, usdt, btc, paypal, capitalist, webmoney, wire)", "Deposit method. PayPal pending gateway; USDT is manual for now."],
        ["amount_cents", "bigint", "Positive for deposit, negative for spend."],
        ["status", "enum(pending, confirmed, failed)", "USDT/wire start 'pending' until confirmed manually."],
        ["external_ref", "varchar, nullable", "Gateway/tx hash for reconciliation."],
        ["created_at", "timestamp", ""],
      ],
    },
    {
      name: "notifications",
      note: "Account event feed shown via the bell icon. Generated server-side on status changes, deposits, etc — the UI currently generates these client-side as a stand-in.",
      cols: [
        ["id", "uuid PK", ""],
        ["advertiser_id", "FK → advertisers.id", ""],
        ["type", "enum(offer_submitted, offer_approved, offer_rejected, draft_saved, low_balance, spend_alert, tracking_issue)", "SYSTEM. Drives icon/copy."],
        ["message", "varchar(255)", "Human-readable text shown in the dropdown."],
        ["read", "boolean, default false", "Marked true when the advertiser opens the bell."],
        ["created_at", "timestamp", ""],
      ],
    },
  ],
  endpoints: [
    ["POST /api/offers", "Create offer. status=draft if saved as draft (only `name` required), status=pending if sent to moderation (full validation). Includes child country/targeting rows. Attach advertiser_id from session, not the body."],
    ["PATCH /api/offers/:id", "Update a draft (or re-save) while status=draft. Once status != draft, edits should go through a separate change-request flow, not a silent overwrite."],
    ["PATCH /api/offers/:id/submit", "Promote a draft to status=pending — runs full validation server-side (see flags below) before accepting."],
    ["GET /api/offers?advertiser_id=&status=", "List this advertiser's offers for 'My Offers & Stats', optionally filtered by status (draft/pending/approved/...)."],
    ["DELETE /api/offers/:id", "Delete a draft. Should be blocked once status != draft."],
    ["PATCH /api/offers/:id/status", "ADMIN-ONLY. Approve/reject. Must be auth-gated — the in-UI Approve button is a demo stand-in."],
    ["GET /api/offers/:id/stats", "Stats for an approved offer (refresh cadence TBD)."],
    ["GET /api/notifications?advertiser_id=", "List notifications for the bell dropdown, newest first."],
    ["PATCH /api/notifications/read", "Mark all (or a set) of notifications as read — called when the notifications dropdown is opened."],
  ],
};

const LATEST_CHANGES = [
  "Hover tooltips added to every “?” help icon and lock-badge tooltips (replaces the slow native browser tooltip).",
  "“Member area” traffic and “Collect converters” retargeting are now LOCKED — visible but non-selectable, with an “Admin” lock badge. They’re configured by our team, not self-serve.",
  "Removed the per-country budget-split %: with a single flat rate per conversion, splitting a budget percentage across countries was redundant. Countries is now a plain searchable multi-select with a Remove action per selected country.",
  "Countries are now chosen via a searchable multi-select — type to filter the full country list, click or press Enter to add, and remove with the tag’s × (or Backspace) or the Remove button in the selected list.",
  "Added a spotlight product tour: auto-runs on first visit and is re-runnable anytime via the “?” button on the rail. It dims the page and walks through the rail, each campaign step, the summary, add-funds, and submit.",
  "Reframed the CPA field as the advertiser’s single rate per conversion (what they pay & all they see). Locked the commission model: publisher gets 70%, platform keeps 30% (editable per offer, admin-only). Publisher payout and margin are never exposed to the advertiser — documented in the data model with a worked example.",
  "Stats wall: advertiser sees completes, clicks, conv. rate, their spend, and balance only. publisher_cost and platform_margin are admin-only and must be stripped from any advertiser-facing response.",
  "Added client-side form validation before “Send to moderation” (required name, valid URL, at least one country, CPA rate / budget > 0, Quality Guidelines accepted) with inline error messages.",
  "Added a duplicate-submission guard: the submit button disables and shows a spinner while the offer is being created.",
  "Removed the advertiser-facing “Build notes” panel from the Campaign Builder page; internal docs live in Implementation Notes only.",
  "Removed the “RewardCash” brand name from the campaign-name example placeholder.",
  "Added “Save as Draft” alongside “Send to moderation”: drafts only require a campaign name, aren’t sent to moderation, and stay fully editable. My Offers & Stats shows a Draft badge with Edit / Delete; editing a draft shows an “Editing draft” pill and the submit button becomes “Start Campaign”.",
  "Added a daily-budget-reset timezone selector (UTC/EST/PST/GMT/CET/IST/local) in the Budget step, plus a read-only timezone indicator in the toolbar.",
  "Added a notifications bell in the toolbar with an unread-count dot and dropdown feed (offer submitted, draft saved, offer approved); opening it marks all as read.",
  "Added Browser language targeting (English, Spanish, Portuguese, Arabic, Hindi, French, German, Indonesian, Russian, Turkish) as a new chip group in Targeting.",
  "Added a VPN traffic toggle (All traffic / No VPN / Only VPN) in Targeting — fraud/quality control, defaults to All, recommended No VPN for CPA.",
  "Added an optional spend-alert: “Notify me when spend reaches a threshold” checkbox + amount field in the Budget step."
];

const SERVER_RULES = [
  "Validate server-side on submit (status=draft → pending): quality_ack must be true; advertiser_rate required and > 0 when pricing=cpa; daily_budget_cents or total_budget_cents required and > 0 depending on budget_mode; at least one offer_countries row; target_url must be a valid http(s) URL; reject locked values (traffic_type='member', retarget='converted') from advertiser input. Drafts (status=draft) only require name.",
  "MARGIN GUARD: publisher_payout_cents must always be < advertiser_rate_cents. Compute it server-side as advertiser_rate × (100 − margin_pct)/100 (default margin_pct=30 → publisher gets 70%). Never let the two cross or you lose money per conversion.",
  "Never accept publisher_payout_cents, margin_pct, or per-country bid overrides from the client — admin-only, even though the demo carries placeholder bids.",
  "Advertiser stats response must include ONLY: conversions, clicks, conversion_rate, advertiser_spend, balance. Strip publisher_cost and platform_margin from any payload the advertiser can reach.",
  "Money everywhere in minor units (cents) to avoid float errors; the UI shows dollars.",
  "advertiser_id must come from the authenticated session, never the request body.",
  "The timezone field only affects when the DAILY budget cap resets (midnight in that zone) — it does not change the rate, total budget, or scheduling of start/end dates."
];

const WORKED_EXAMPLE = [
  "Advertiser sets their rate: $1.50 per conversion.",
  "Publisher payout (70%): $1.05 per conversion — admin-only.",
  "Platform margin (30%): $0.45 per conversion — admin-only.",
  "150 conversions → advertiser billed 150 × $1.50 = $225 (deducted from balance).",
  "You pay publishers 150 × $1.05 = $157.50; you keep 150 × $0.45 = $67.50.",
  "Advertiser only ever sees: 150 completes, their $1.50 rate, $225 spent. Nothing about the $1.05 or $0.45."
];

function AdvertiserReportsPage({ t }: any) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  const [range, setRange] = useState("last_7_days");
  const [breakdown, setBreakdown] = useState("date");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>({ kpis: {}, breakdown: [], conversions: [] });

  const fetchData = async () => {
    try {
      setLoading(true);
      setError("");
      const token = localStorage.getItem('advertiser_token');
      const res = await fetch(`${API_BASE}/api/advertiser/reports?range=${range}&breakdown=${breakdown}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to fetch report data");
      }
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [range, breakdown]);

  const exportCSV = () => {
    if (!data.breakdown || data.breakdown.length === 0) return;
    
    let headers = [breakdown.toUpperCase(), "IMPRESSIONS", "CLICKS", "CTR", "CONVERSIONS", "CR%", "SPEND", "CPA"];
    let csvRows = [headers.join(",")];
    
    data.breakdown.forEach((row: any) => {
      const label = breakdown === 'campaign' ? row.campaign_name : row.key;
      csvRows.push([
        `"${label}"`,
        row.impressions,
        row.clicks,
        `${row.ctr}%`,
        row.conversions,
        `${row.cr}%`,
        `$${row.spend.toFixed(2)}`,
        `$${row.cpa.toFixed(2)}`
      ].join(","));
    });
    
    // Add total row
    const totalImpressions = data.breakdown.reduce((sum: number, r: any) => sum + r.impressions, 0);
    const totalClicks = data.breakdown.reduce((sum: number, r: any) => sum + r.clicks, 0);
    const totalConversions = data.breakdown.reduce((sum: number, r: any) => sum + r.conversions, 0);
    const totalSpend = data.breakdown.reduce((sum: number, r: any) => sum + r.spend, 0);
    const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100).toFixed(2) : "0.00";
    const totalCr = totalClicks > 0 ? (totalConversions / totalClicks * 100).toFixed(2) : "0.00";
    const totalCpa = totalConversions > 0 ? (totalSpend / totalConversions).toFixed(2) : "0.00";
    
    csvRows.push([
      `"TOTAL"`,
      totalImpressions,
      totalClicks,
      `${totalCtr}%`,
      totalConversions,
      `${totalCr}%`,
      `$${totalSpend.toFixed(2)}`,
      `$${totalCpa}`
    ].join(","));
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `advertiser_report_${breakdown}_${range}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const money = (n: any) => "$" + (Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (n: any) => (Number(n) || 0).toLocaleString("en-US");

  // Sum up totals for table footer
  const totalImpressions = data.breakdown?.reduce((sum: number, r: any) => sum + r.impressions, 0) || 0;
  const totalClicks = data.breakdown?.reduce((sum: number, r: any) => sum + r.clicks, 0) || 0;
  const totalConversions = data.breakdown?.reduce((sum: number, r: any) => sum + r.conversions, 0) || 0;
  const totalSpend = data.breakdown?.reduce((sum: number, r: any) => sum + r.spend, 0) || 0;
  const totalCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
  const totalCr = totalClicks > 0 ? (totalConversions / totalClicks * 100) : 0;
  const totalCpa = totalConversions > 0 ? (totalSpend / totalConversions) : 0;

  return (
    <div style={{ padding: "30px 40px", display: "flex", flexDirection: "column", gap: 30, background: t.bgGrad, minHeight: "100vh" }}>
      {/* Title Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: t.text, margin: 0, letterSpacing: "-0.025em" }}>Reports</h1>
          <p style={{ margin: "5px 0 0 0", fontSize: 14, color: t.textDim }}>Track your advertiser campaign performance in real-time</p>
        </div>
        
        {/* Date Filters & Export */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <select 
            value={range} 
            onChange={(e) => setRange(e.target.value)}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${t.border}`,
              background: t.panel,
              color: t.text,
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
              outline: "none",
              boxShadow: t.shadowSm
            }}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="this_month">This Month</option>
            <option value="all">All Time</option>
          </select>
          
          <button
            onClick={exportCSV}
            disabled={!data.breakdown || data.breakdown.length === 0}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 18px",
              borderRadius: 10,
              background: t.brandGrad,
              color: "#fff",
              border: "none",
              fontSize: 14,
              fontWeight: 700,
              cursor: (!data.breakdown || data.breakdown.length === 0) ? "not-allowed" : "pointer",
              opacity: (!data.breakdown || data.breakdown.length === 0) ? 0.5 : 1,
              boxShadow: t.glow,
              transition: "transform 0.2s ease"
            }}
            onMouseEnter={(e) => {
              if (data.breakdown && data.breakdown.length > 0) e.currentTarget.style.transform = "scale(1.03)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            <FileText className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 20 }}>
        {[
          { label: "Impressions", val: num(data.kpis?.impressions), color: t.brand },
          { label: "Clicks", val: num(data.kpis?.clicks), color: t.brand2 },
          { label: "CTR", val: (data.kpis?.ctr || 0) + "%", color: t.amber },
          { label: "Conversions", val: num(data.kpis?.conversions), color: t.green },
          { label: "CR%", val: (data.kpis?.cr || 0) + "%", color: t.green },
          { label: "Spend", val: money(data.kpis?.spend), color: t.red },
          { label: "Avg CPA", val: money(data.kpis?.avg_cpa), color: t.textDim }
        ].map((c, i) => (
          <div 
            key={i} 
            style={{ 
              background: t.panel, 
              border: `1px solid ${t.border}`, 
              borderRadius: 16, 
              padding: 20, 
              boxShadow: t.shadowSm, 
              transition: "all 0.3s ease",
              cursor: "default"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = t.borderHi;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = t.border;
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, color: t.textDim }}>{c.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 8 }}>{c.val}</div>
          </div>
        ))}
      </div>

      {/* Breakdown Section */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, boxShadow: t.shadowSm }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: t.text }}>Breakdown by:</div>
          <div style={{ display: "flex", gap: 8, background: t.panelAlt, padding: 4, borderRadius: 10, border: `1px solid ${t.border}` }}>
            {["date", "campaign", "country", "device"].map((b) => (
              <button
                key={b}
                onClick={() => setBreakdown(b)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: breakdown === b ? t.brand : "transparent",
                  color: breakdown === b ? "#fff" : t.textDim,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
              >
                {b.charAt(0).toUpperCase() + b.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: t.textDim, fontSize: 14 }}>Loading report data...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: "center", color: t.red, fontSize: 14 }}>Error: {error}</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${t.border}` }}>
                  <th style={{ textAlign: "left", padding: 12, color: t.textDim, fontWeight: 600 }}>{breakdown.toUpperCase()}</th>
                  <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>IMPRESSIONS</th>
                  <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>CLICKS</th>
                  <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>CTR</th>
                  <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>CONVERSIONS</th>
                  <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>CR%</th>
                  <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>SPEND</th>
                  <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>CPA</th>
                </tr>
              </thead>
              <tbody>
                {data.breakdown?.map((row: any, idx: number) => (
                  <tr 
                    key={idx} 
                    style={{ 
                      borderBottom: `1px solid ${t.border}`,
                      background: idx % 2 === 0 ? "transparent" : t.panelAlt
                    }}
                  >
                    <td style={{ padding: 12, fontWeight: 600, color: t.text }}>
                      {breakdown === 'campaign' ? row.campaign_name : row.key}
                    </td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(row.impressions)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(row.clicks)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.ctr.toFixed(2)}%</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600, color: t.green }}>{num(row.conversions)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{row.cr.toFixed(2)}%</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{money(row.spend)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: t.textDim }}>{money(row.cpa)}</td>
                  </tr>
                ))}
                
                {(!data.breakdown || data.breakdown.length === 0) && (
                  <tr>
                    <td colSpan={8} style={{ padding: 40, textAlign: "center", color: t.textFaint }}>No data available for this range</td>
                  </tr>
                )}
              </tbody>
              
              {data.breakdown && data.breakdown.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: `2px solid ${t.border}`, fontWeight: 800, background: t.panelAlt }}>
                    <td style={{ padding: 12, color: t.text }}>TOTAL</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(totalImpressions)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{num(totalClicks)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{totalCtr.toFixed(2)}%</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: t.green }}>{num(totalConversions)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{totalCr.toFixed(2)}%</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{money(totalSpend)}</td>
                    <td style={{ padding: 12, textAlign: "right", fontVariantNumeric: "tabular-nums", color: t.textDim }}>{money(totalCpa)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Conversion Log */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, boxShadow: t.shadowSm }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: t.text, margin: "0 0 4px 0" }}>Conversion log</h3>
        <p style={{ fontSize: 13, color: t.textDim, margin: "0 0 20px 0" }}>Individual conversions received via postback. Pending entries are awaiting validation.</p>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${t.border}` }}>
                <th style={{ textAlign: "left", padding: 12, color: t.textDim, fontWeight: 600 }}>TIME</th>
                <th style={{ textAlign: "left", padding: 12, color: t.textDim, fontWeight: 600 }}>CONV. ID</th>
                <th style={{ textAlign: "left", padding: 12, color: t.textDim, fontWeight: 600 }}>OFFER</th>
                <th style={{ textAlign: "center", padding: 12, color: t.textDim, fontWeight: 600 }}>GEO</th>
                <th style={{ textAlign: "center", padding: 12, color: t.textDim, fontWeight: 600 }}>DEVICE</th>
                <th style={{ textAlign: "left", padding: 12, color: t.textDim, fontWeight: 600 }}>GOAL</th>
                <th style={{ textAlign: "right", padding: 12, color: t.textDim, fontWeight: 600 }}>PAYOUT</th>
                <th style={{ textAlign: "center", padding: 12, color: t.textDim, fontWeight: 600 }}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data.conversions?.map((c: any, idx: number) => (
                <tr 
                  key={idx} 
                  style={{ 
                    borderBottom: `1px solid ${t.border}`,
                    background: idx % 2 === 0 ? "transparent" : t.panelAlt
                  }}
                >
                  <td style={{ padding: 12, color: t.textDim, fontVariantNumeric: "tabular-nums" }}>
                    {new Date(c.time).toLocaleString()}
                  </td>
                  <td style={{ padding: 12, fontFamily: "monospace", color: t.text }}>{c.conversion_id}</td>
                  <td style={{ padding: 12, fontWeight: 600, color: t.text }}>{c.offer_name}</td>
                  <td style={{ padding: 12, textAlign: "center" }}>{c.geo}</td>
                  <td style={{ padding: 12, textAlign: "center", textTransform: "capitalize" }}>{c.device}</td>
                  <td style={{ padding: 12, color: t.textDim }}>{c.goal}</td>
                  <td style={{ padding: 12, textAlign: "right", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{money(c.payout)}</td>
                  <td style={{ padding: 12, textAlign: "center" }}>
                    <span style={{ 
                      fontSize: 11, 
                      fontWeight: 700, 
                      padding: "4px 8px", 
                      borderRadius: 4, 
                      color: c.status === 'approved' ? t.green : t.amber, 
                      background: c.status === 'approved' ? t.greenSoft : t.amberSoft 
                    }}>
                      {c.status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              
              {(!data.conversions || data.conversions.length === 0) && (
                <tr>
                  <td colSpan={8} style={{ padding: 40, textAlign: "center", color: t.textFaint }}>No conversions recorded yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ImplementationNotesPage({ t }: any) {
  const badgeStyle = (status: any) => {
    if (status === "pending" || status === "todo") return { color: "#b45309", bg: "#fef3c7", text: "TO DO" };
    return { color: "#6d28d9", bg: "#ede9fe", text: "NEEDS DISCUSSION" };
  };

  return (
    <div style={{ width: "100%", padding: "32px 24px 80px", boxSizing: "border-box" }}>
      {/* Page Header */}
      <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>Implementation Notes</h1>
      <p style={{ fontSize: 14.5, color: t.brand, fontWeight: 500, margin: "8px 0 28px", lineHeight: 1.5 }}>
        Roadmap for getting this Campaign Builder live inside the existing advertiser dashboard (advertisers.moustacheleads.com), connecting offer submission to the admin dashboard for approval, wiring up stats, and getting payments working. This page is for internal/dev reference — remove before public launch.
      </p>

      {/* Latest changes — what happened */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 32, boxShadow: t.shadowSm }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: "0 0 18px 0" }}>
          <Check size={18} color={t.green} style={{ background: t.greenSoft, borderRadius: "50%", padding: 2 }} />
          Latest changes — what happened
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {LATEST_CHANGES.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: t.greenSoft, borderRadius: 8, border: `1px solid ${t.green}15` }}>
              <Check size={15} color={t.green} style={{ flexShrink: 0, marginTop: 3 }} />
              <span style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Integration Phases */}
      <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 40, marginBottom: 16, letterSpacing: -0.3 }}>Integration Phases</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 20, marginBottom: 36 }}>
        {IMPLEMENTATION_PHASES.map((phase) => (
          <div key={phase.id} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, boxShadow: t.shadowSm }}>
            <h3 style={{ fontSize: 16, fontWeight: 750, margin: "0 0 6px 0", display: "flex", gap: 10, alignItems: "center" }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: 6, background: t.brandSoft, color: t.brand, fontSize: 12, fontWeight: 700 }}>{phase.id}</span>
              {phase.title}
            </h3>
            <p style={{ fontSize: 13, color: t.textDim, margin: "0 0 16px 0", lineHeight: 1.5 }}>{phase.desc}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {phase.items.map((item, idx) => {
                const badge = badgeStyle(item.status);
                return (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", padding: "10px 16px", background: t.panelAlt, borderRadius: 8, border: `1px solid ${t.border}` }}>
                    <span style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>{item.text}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, color: badge.color, background: badge.bg, padding: "4px 8px", borderRadius: 6, textTransform: "uppercase", flexShrink: 0 }}>
                      {badge.text}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Commission model decided banner */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "16px 20px", background: t.greenSoft, border: `1px solid ${t.green}30`, borderRadius: 10, fontSize: 13.5, lineHeight: 1.5, marginBottom: 36 }}>
        <Check size={18} color={t.green} style={{ flexShrink: 0, marginTop: 2, background: `${t.green}20`, borderRadius: "50%", padding: 2 }} />
        <span style={{ color: t.text }}>
          <strong>Commission model decided:</strong> advertiser sets a single rate per conversion; publisher gets 70% (platform keeps 30%), editable per offer on the admin side. Publisher payout and margin are never shown to the advertiser. See the full data model and worked example below.
        </span>
      </div>

      {/* Data Model */}
      <h2 style={{ fontSize: 19, fontWeight: 800, marginTop: 40, marginBottom: 16, letterSpacing: -0.3 }}>Data model — database alignment</h2>
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, boxShadow: t.shadowSm, marginBottom: 36 }}>
        <p style={{ fontSize: 13.5, color: t.textDim, lineHeight: 1.6, margin: "0 0 24px 0" }}>{DATA_MODEL.intro}</p>
        
        {DATA_MODEL.tables.map((table) => (
          <div key={table.name} style={{ marginBottom: 28 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: t.brand, marginBottom: 4 }}>
              Table: {table.name}
            </div>
            <p style={{ fontSize: 12.5, color: t.textDim, margin: "0 0 12px 0", lineHeight: 1.45 }}>{table.note}</p>
            <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "180px 170px 1fr", background: t.panelAlt, padding: "10px 14px", borderBottom: `1px solid ${t.border}`, fontSize: 11, fontWeight: 800, color: t.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
                <span>Column</span>
                <span>Type</span>
                <span>Notes · set by</span>
              </div>
              {table.cols.map(([col, type, desc]) => (
                <div key={col} style={{ display: "grid", gridTemplateColumns: "180px 170px 1fr", padding: "10px 14px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5, lineHeight: 1.45, background: t.panel }}>
                  <span style={{ fontFamily: "monospace", fontWeight: 700, color: t.text }}>{col}</span>
                  <span style={{ color: t.textDim, fontFamily: "monospace", fontSize: 11.5 }}>{type}</span>
                  <span style={{ color: t.textDim }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Endpoints */}
        <h3 style={{ fontSize: 16, fontWeight: 800, marginTop: 36, marginBottom: 14 }}>Suggested REST Endpoints</h3>
        <div style={{ border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", background: t.panelAlt, padding: "10px 14px", borderBottom: `1px solid ${t.border}`, fontSize: 11, fontWeight: 800, color: t.textDim, textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>Endpoint (HTTP Method & Path)</span>
            <span>Usage / Description</span>
          </div>
          {DATA_MODEL.endpoints.map(([ep, desc]) => (
            <div key={ep} style={{ display: "grid", gridTemplateColumns: "280px 1fr", padding: "10px 14px", borderBottom: `1px solid ${t.border}`, fontSize: 12.5, lineHeight: 1.45, background: t.panel }}>
              <span style={{ fontFamily: "monospace", fontWeight: 700, color: t.brand }}>{ep}</span>
              <span style={{ color: t.textDim }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Server-side rules & gotchas */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, marginBottom: 36, boxShadow: t.shadowSm }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, margin: "0 0 18px 0" }}>
          <Info size={18} color={t.amber} style={{ background: t.amberSoft, borderRadius: "50%", padding: 2 }} />
          Server-side rules & gotchas (don't trust the client)
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SERVER_RULES.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: t.amberSoft, borderRadius: 8, border: `1px solid ${t.amber}15` }}>
              <Info size={15} color={t.amber} style={{ flexShrink: 0, marginTop: 3 }} />
              <span style={{ fontSize: 13, lineHeight: 1.5, color: t.text }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Commission / margin model & Worked example */}
      <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 24, boxShadow: t.shadowSm }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 8px 0", color: t.brand }}>Commission / margin model</h2>
        <p style={{ fontSize: 13.5, color: t.textDim, margin: "0 0 20px 0", lineHeight: 1.5 }}>
          Default split: publisher gets 70% of the advertiser's rate, platform keeps 30%. The 30% (margin_pct) is editable per offer on the admin side; the advertiser never sees it.
        </p>

        <h3 style={{ fontSize: 14, fontWeight: 800, margin: "0 0 12px 0", textTransform: "uppercase", letterSpacing: 0.5, color: t.textDim }}>Worked Example</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {WORKED_EXAMPLE.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", background: t.panelAlt, borderRadius: 8, border: `1px solid ${t.border}` }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, borderRadius: "50%", background: t.brandSoft, color: t.brand, fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                {idx + 1}
              </span>
              <span style={{ fontSize: 13, color: t.text }}>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
