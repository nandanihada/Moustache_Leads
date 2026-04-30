<p align="center">
  <img src="https://img.shields.io/badge/Platform-Moustache%20Leads-orange?style=for-the-badge&logo=rocket&logoColor=white" alt="Moustache Leads" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Flask-3-000000?style=for-the-badge&logo=flask&logoColor=white" alt="Flask" />
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
</p>

# 🚀 Moustache Leads

**A full-stack performance marketing & affiliate network platform** that connects advertisers with publishers to drive conversions through an intelligent offerwall system.

> Advertisers create campaigns. Publishers promote them. End users complete offers. Everyone earns.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React + TypeScript)            │
│                        Hosted on Vercel                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Admin    │  │Publisher │  │Advertiser│  │  Offerwall   │   │
│  │Dashboard │  │Dashboard │  │Dashboard │  │  (Embed)     │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘   │
│       │              │              │               │           │
│       └──────────────┴──────────────┴───────────────┘           │
│                              │                                  │
│                     REST API Calls                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     BACKEND (Flask + Python)                     │
│                     Hosted on Render (Gunicorn)                  │
│                                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │
│  │  Auth &  │  │  Offer   │  │ Tracking │  │  Analytics   │    │
│  │  Users   │  │  Engine  │  │  System  │  │  & Reports   │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘    │
│       │              │              │               │            │
│  ┌────┴──────────────┴──────────────┴───────────────┴────┐      │
│  │              Background Services                       │      │
│  │  Cap Monitor │ Postback Processor │ Email Scheduler    │      │
│  └────────────────────────┬──────────────────────────────┘      │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                    MongoDB Atlas (ascend_db)                      │
│                                                                  │
│  offers │ users │ publishers │ advertisers │ conversions │ ...   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 👥 User Roles

| Role | Access | Description |
|------|--------|-------------|
| 🔴 **Admin** | Full platform control | Manage offers, publishers, advertisers, analytics, fraud, subadmins |
| 🟠 **Subadmin** | Scoped admin access | Admin with tab-level permissions delegated by admin |
| 🟢 **Publisher** | Publisher dashboard | Promote offers, manage placements, earn commissions, redeem rewards |
| 🔵 **Advertiser** | Advertiser dashboard | Create campaigns, track conversions, view performance |
| ⚪ **End User** | Offerwall | Complete offers and earn rewards |

---

## ✨ Features

### 🎯 Offer Management
- **Offer CRUD** — Create, edit, activate, pause, and archive offers with full targeting rules
- **Bulk Upload** — Import offers via Excel/CSV with validation and skip-invalid-rows support
- **API Import** — Pull offers directly from ad network APIs (HasOffers, Everflow, etc.)
- **Offer Health Monitoring** — Automated health checks with status indicators
- **Offer Rotation** — Smart rotation engine to distribute traffic across offers
- **Schedule Rules** — Time-based activation/deactivation rules per offer
- **Geo Restrictions** — Country and region-level targeting
- **Traffic Source Rules** — Control which traffic sources can run each offer
- **Smart Activation** — Rule-based auto-activation for offers meeting criteria
- **Offer Categories** — Organize offers by vertical (Finance, Gaming, Shopping, etc.)

```
┌─────────────────── Offer Lifecycle ───────────────────┐
│                                                        │
│  Created ──► Pending ──► Active ──► Paused ──► Ended  │
│                │                      │                │
│                ▼                      ▼                │
│           Rejected              Cap Reached            │
│                                                        │
│  Health Check: ✅ Live  ⚠️ Warning  ❌ Dead            │
└────────────────────────────────────────────────────────┘
```

### 📊 Tracking & Conversions
- **Click Tracking** — Track every click with link masking and macro replacement
- **Postback System** — Server-to-server conversion tracking (S2S)
- **Postback Pipeline** — Visual pipeline view of postback processing stages
- **Partner Postback Forwarding** — Forward conversions to publisher endpoints
- **Smart Links** — Dynamic redirect links that auto-optimize to best offers
- **Conversion Reports** — Detailed conversion data with fraud scoring

```
  User Click          Tracking Server         Ad Network
      │                     │                     │
      ├──── Click ─────────►│                     │
      │                     ├── Log + Redirect ──►│
      │                     │                     │
      │                     │◄── Postback ────────┤
      │                     │                     │
      │                     ├── Validate          │
      │                     ├── Score Fraud        │
      │                     ├── Record Conversion  │
      │                     ├── Forward to Partner │
      │                     ▼                     │
```

### 👤 Publisher Portal
- **Publisher Dashboard** — Earnings overview, performance charts, quick stats
- **Offer Marketplace** — Browse and request access to available offers
- **Placement Management** — Create and manage ad placements with proof uploads
- **Promo Codes** — Generate and manage promotional codes
- **Gift Card Redemption** — Redeem earnings for gift cards
- **Referral Program** — Earn commissions by referring new publishers
- **Smart Link** — Auto-optimizing links for maximum conversions
- **Reports** — Performance and conversion reports with date filtering
- **Support** — In-app support messaging with admin

### 📢 Advertiser Portal
- **Advertiser Dashboard** — Campaign performance overview
- **Campaign Management** — Create and manage advertising campaigns
- **Statistics** — Conversion and performance tracking
- **Billing** — Payment and invoice management

### 🛡️ Admin Panel

```
┌─────────────────── Admin Panel Modules ───────────────────┐
│                                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │  Offers    │  │  Partners  │  │  Analytics &       │  │
│  │  Manager   │  │  Manager   │  │  Reports           │  │
│  └────────────┘  └────────────┘  └────────────────────┘  │
│                                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │  Fraud     │  │  Tracking  │  │  Email & Comms     │  │
│  │  Detection │  │  & Logs    │  │  Management        │  │
│  └────────────┘  └────────────┘  └────────────────────┘  │
│                                                            │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │  Gift Card │  │  Surveys   │  │  Subadmin &        │  │
│  │  System    │  │  & Polls   │  │  Permissions       │  │
│  └────────────┘  └────────────┘  └────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

- **Dashboard Overview** — Real-time stats boxes with key metrics
- **Offer Management** — Full offer CRUD with bulk operations, health checks, and rotation
- **Publisher Management** — Approve/reject publishers, view intelligence panels, analytics
- **Advertiser Management** — Manage advertiser accounts and campaigns
- **Placement Approval** — Review and approve publisher placements with proof verification
- **Offer Access Requests** — Manage publisher requests for offer access
- **Fraud Management** — Fraud scoring, fake conversion flagging, suspicious activity detection
- **Analytics Suite** — Network, vertical, geo, and status-level analytics
- **Offerwall Analytics** — Comprehensive offerwall performance tracking
- **Click Tracking** — Detailed click-level data with geo and device info
- **Login Logs** — Track user login activity with IP and location data
- **Activity Logs** — Full admin action audit trail
- **Search Logs** — Monitor what users are searching for
- **Email Activity** — Track all outbound email communications
- **Postback Pipeline** — Visual postback processing monitor
- **Gift Card Management** — Create and manage gift card inventory
- **Survey Gateway** — Manage third-party survey integrations
- **Polls** — Create and manage user polls
- **Referral Management** — Monitor referral program with fraud detection
- **Reactivation** — Re-engage inactive publishers
- **Smart Links** — Manage smart link configurations
- **Masked Links** — Link masking management
- **Promo Codes** — Platform-wide promotional code management
- **Subadmin Management** — Create subadmins with granular tab-level permissions
- **Support Inbox** — Respond to publisher support messages
- **Notes** — Internal admin notes system
- **Payments** — Manage publisher payments and invoices

### 🧱 Offerwall
- **Embeddable Widget** — Drop-in offerwall for publisher websites
- **Professional Theme** — Polished UI with category filtering
- **Geo-Aware** — Shows offers based on user location
- **Reward Tracking** — Track user completions and reward distribution

### 📧 Email System
- **SMTP Integration** — Hostinger SMTP for transactional emails
- **Email Verification** — Account verification flow
- **Scheduled Emails** — Automated email campaigns
- **Template Builder** — Customizable email templates
- **Insight Campaigns** — Offer insight email campaigns to publishers
- **Bulk Email** — Send bulk communications to publishers

### 🔐 Authentication & Security
- **JWT Authentication** — Token-based auth with cookie + localStorage
- **Role-Based Access** — Admin, Subadmin, Publisher, Advertiser roles
- **Email Verification** — Required email verification for new accounts
- **Password Reset** — Secure password reset flow
- **Subdomain Routing** — Different experiences per subdomain
- **Cross-Subdomain Auth** — Seamless auth across all subdomains

---

## 🏗️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 | UI Framework |
| TypeScript | Type Safety |
| Vite 5 | Build Tool |
| Tailwind CSS | Styling |
| shadcn/ui | UI Components |
| React Router v6 | Routing |
| TanStack Query v5 | Data Fetching |
| React Hook Form + Zod | Forms & Validation |
| Recharts | Charts & Graphs |
| Framer Motion | Animations |
| Sonner | Toast Notifications |

### Backend
| Technology | Purpose |
|-----------|---------|
| Flask 3 | Web Framework |
| Python 3 | Language |
| MongoDB Atlas | Database |
| PyMongo 4 | Database Driver |
| PyJWT | Authentication |
| bcrypt | Password Hashing |
| Gunicorn | WSGI Server |
| smtplib | Email Sending |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Vercel | Frontend Hosting |
| Render | Backend Hosting |
| MongoDB Atlas | Database Hosting |

---

## 🌐 Production Domains

| Domain | Purpose |
|--------|---------|
| `moustacheleads.com` | Main website |
| `dashboard.moustacheleads.com` | Admin dashboard |
| `offers.moustacheleads.com` | Publisher offers & tracking |
| `offerwall.moustacheleads.com` | Embeddable offerwall |
| `api.moustacheleads.com` | Backend API |

---

## 📁 Project Structure

```
Moustache_Leads/
├── backend/                  # Flask API
│   ├── app.py                # App factory & blueprint registration
│   ├── config.py             # Environment configuration
│   ├── database.py           # MongoDB singleton connection
│   ├── gunicorn.conf.py      # Production WSGI config
│   ├── models/               # MongoDB document models
│   ├── routes/               # Flask blueprints (one per feature)
│   ├── services/             # Business logic services
│   └── utils/                # Shared helpers & decorators
│
├── src/                      # React frontend
│   ├── App.tsx               # Root router & providers
│   ├── pages/                # Route-level page components
│   ├── components/           # Reusable UI components
│   │   ├── ui/               # shadcn/ui primitives
│   │   ├── layout/           # Layout shells (Admin, Publisher, Advertiser)
│   │   ├── dashboard/        # Dashboard widgets
│   │   └── reports/          # Report components
│   ├── services/             # API call functions
│   ├── contexts/             # React contexts (Auth)
│   ├── hooks/                # Custom React hooks
│   └── utils/                # Frontend helpers
│
├── public/                   # Static assets
├── package.json
├── vite.config.ts
├── tailwind.config.ts
└── vercel.json
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- MongoDB Atlas account (or local MongoDB)

### Frontend Setup
```bash
cd Moustache_Leads
npm install
npm run dev          # Starts on http://localhost:8080
```

### Backend Setup
```bash
cd Moustache_Leads/backend
pip install -r requirements.txt
# Configure .env with your MongoDB URI, JWT secret, etc.
python run.py        # Starts on http://localhost:5000
```

### Environment Variables

**Frontend** (`.env`)
```
VITE_API_URL=http://127.0.0.1:5000
```

**Backend** (`.env`)
```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET_KEY=your_jwt_secret
FLASK_ENV=development
PORT=5000
```

---

## 🔄 How It Works

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│Advertiser│     │  Admin   │     │Publisher │     │ End User │
│          │     │          │     │          │     │          │
│ Creates  │────►│ Approves │────►│ Promotes │────►│Completes │
│ Campaign │     │ & Sets   │     │  Offers  │     │  Offer   │
│          │     │  Rules   │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └─────┬────┘
                                                         │
                                                         ▼
                                                   ┌──────────┐
                                                   │ Postback  │
                                                   │ Received  │
                                                   │           │
                                                   │ Publisher │
                                                   │  Earns $  │
                                                   └──────────┘
```

1. **Advertiser** creates a campaign with targeting rules and payout
2. **Admin** reviews, approves, and configures offer settings
3. **Publisher** discovers offers and promotes them via placements or offerwall
4. **End User** clicks the offer, gets tracked, and completes the action
5. **Ad Network** fires a postback confirming the conversion
6. **Platform** validates, scores for fraud, records conversion, and credits publisher

---

## 📄 License

This project is proprietary software. All rights reserved.

---

<p align="center">
  Built with ❤️ by the <strong>Moustache Leads</strong> team
</p>
