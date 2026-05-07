# 👑 CrownPoint — VIP Celebrity Fan Connection Platform

> A luxury platform connecting fans with their favourite celebrities through exclusive personalised experiences.

---

## 🎯 Project Overview

CrownPoint is a full-stack web application that enables fans to book exclusive experiences with verified celebrities — from personal video messages to live calls, signed merchandise, and VIP meet & greets. All payments are processed manually with a dedicated admin verification system.

**Brand Identity**
- Aesthetic: Cinematic luxury — dark green, gold, elegant serif typography
- Fonts: Cormorant Garamond (display), EB Garamond (body), Josefin Sans (UI)
- Colours: Deep green `#061a10`, Gold `#c9a962`, White `#ffffff`

---

## 🏗️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React 19 + Vite 8                   |
| Routing    | React Router v7                     |
| Animation  | Framer Motion v12                   |
| Icons      | Lucide React                        |
| HTTP       | Axios (Spring Boot ready)           |
| Styling    | CSS Modules + Global CSS Variables  |
| Backend    | Spring Boot (handled separately)    |
| Auth       | JWT (stubbed, backend to implement) |

---

## 📁 Project Structure

```
crownpoint/
├── public/
│   └── favicon.svg
├── src/
│   ├── App.jsx                  # Router + page transitions
│   ├── main.jsx                 # Entry point + context providers
│   ├── index.css                # Master stylesheet (imports all)
│   │
│   ├── assets/
│   │   ├── icons/               # SVG icons
│   │   └── images/              # Static images
│   │
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.jsx       # Floating pill header (Step 5)
│   │   │   ├── Footer.jsx       # 4-column footer (Step 6)
│   │   │   ├── PageWrapper.jsx  # Page layout wrapper (Step 6)
│   │   │   └── Sidebar.jsx      # Dashboard sidebar (Step 9)
│   │   └── ui/
│   │       ├── Button.jsx       # Reusable button variants (Step 7)
│   │       ├── Badge.jsx        # Category/tag badges (Step 7)
│   │       ├── Avatar.jsx       # User/talent avatars (Step 7)
│   │       ├── Card.jsx         # Surface card wrapper (Step 7)
│   │       ├── StatusBadge.jsx  # Order status badges (Step 7)
│   │       ├── Divider.jsx      # Gold divider line (Step 7)
│   │       ├── Toast.jsx        # Toast notifications (Step 7)
│   │       ├── Modal.jsx        # Generic modal (Step 7)
│   │       ├── Loader.jsx       # Loading spinner (Step 7)
│   │       ├── FilterPill.jsx   # Category filter pills (Step 7)
│   │       ├── UploadZone.jsx   # File upload zone (Step 7)
│   │       ├── CountdownTimer.jsx # Payment countdown (Step 7)
│   │       ├── LegalModal.jsx   # NDA/agreement modal ✅ DONE
│   │       └── LegalModal.module.css ✅ DONE
│   │
│   ├── context/
│   │   ├── AuthContext.jsx      # User auth state ✅ DONE
│   │   ├── ToastContext.jsx     # Global toast state ✅ DONE
│   │   └── OrderContext.jsx     # Booking order state ✅ DONE
│   │
│   ├── data/
│   │   ├── talents.js           # 8 mock talent objects ✅ DONE
│   │   ├── testimonials.js      # 5 fan testimonials ✅ DONE
│   │   ├── categories.js        # Talent categories ✅ DONE
│   │   └── legalContent.js      # All legal documents ✅ DONE
│   │
│   ├── hooks/
│   │   ├── useAuth.js           # Auth context hook ✅ DONE
│   │   ├── useToast.js          # Toast context hook ✅ DONE
│   │   ├── useScrollPosition.js # Header scroll detection ✅ DONE
│   │   ├── useTalents.js        # Talent fetch + filter ✅ DONE
│   │   └── useOrders.js         # Order fetch hook ✅ DONE
│   │
│   ├── pages/
│   │   ├── Home.jsx             # Landing page (Step 8-10)
│   │   ├── TalentDirectory.jsx  # Browse talents (Step 11)
│   │   ├── TalentProfile.jsx    # Celebrity profile (Step 12)
│   │   ├── Booking.jsx          # Chat booking flow (Step 13)
│   │   ├── Payment.jsx          # Payment + methods (Step 14)
│   │   ├── FanDashboard.jsx     # Fan account (Step 15)
│   │   ├── AdminPanel.jsx       # Admin verification (Step 16)
│   │   ├── Legal.jsx            # Legal documents ✅ DONE
│   │   ├── Legal.module.css     # Legal page styles ✅ DONE
│   │   └── NotFound.jsx         # 404 page
│   │
│   ├── services/                # All API calls (Spring Boot ready)
│   │   ├── talentService.js     # GET /api/talents ✅ DONE
│   │   ├── orderService.js      # POST /api/orders ✅ DONE
│   │   ├── paymentService.js    # POST /api/payments ✅ DONE
│   │   ├── authService.js       # POST /api/auth ✅ DONE
│   │   ├── adminService.js      # GET /api/admin ✅ DONE
│   │   └── userService.js       # GET /api/users ✅ DONE
│   │
│   ├── styles/
│   │   ├── variables.css        # Design tokens ✅ DONE
│   │   ├── reset.css            # CSS reset ✅ DONE
│   │   ├── typography.css       # Type system ✅ DONE
│   │   ├── animations.css       # Keyframes + classes ✅ DONE
│   │   └── utilities.css        # Utility classes ✅ DONE
│   │
│   └── utils/
│       ├── api.js               # Axios + JWT interceptors ✅ DONE
│       ├── constants.js         # App-wide constants ✅ DONE
│       ├── formatters.js        # Currency, date, etc ✅ DONE
│       └── generateRef.js       # Payment ref codes ✅ DONE
│
├── package.json
├── vite.config.js
└── README.md
```

---

## 🗺️ Pages & Routes

| Route          | Page              | Auth Required | Status        |
|----------------|-------------------|---------------|---------------|
| `/`            | Home              | No            | 🔄 Step 8-10  |
| `/talents`     | Talent Directory  | No            | 🔄 Step 11    |
| `/talent/:id`  | Talent Profile    | No            | 🔄 Step 12    |
| `/book`        | Booking Flow      | No            | 🔄 Step 13    |
| `/payment`     | Payment           | No            | 🔄 Step 14    |
| `/legal`       | Legal Docs        | No            | ✅ Done        |
| `/dashboard`   | Fan Dashboard     | Fan           | 🔄 Step 15    |
| `/admin`       | Admin Panel       | Admin         | 🔄 Step 16    |

---

## 💳 Payment System

CrownPoint uses **manual payment verification** — no traditional payment gateway.

**Supported Methods:**
1. **Bank Transfer** — Fan uploads receipt, admin verifies manually
2. **Gift Cards** — Amazon, Apple, Steam, Google Play, iTunes
3. **Cryptocurrency** — USDT/ETH/BTC with transaction hash verification

**Payment Flow:**
```
Order Created (PENDING_PAYMENT)
    ↓
Fan submits proof
    ↓
Admin reviews (UNDER_REVIEW) ← 5-15 min
    ↓
Approved → PAID → Experience delivered
Rejected → FAILED → Fan retries
```

**Fraud Protection:**
- Unique reference codes per order (REF: #A92KX)
- 30-minute order expiry
- Manual approval required — nothing auto-unlocks
- Crypto verified on-chain, not by screenshot
- Flagging system for suspicious submissions

---

## ⚖️ Legal Architecture

Legal agreements are enforced at 5 touchpoints:

| Touchpoint        | Document                    | Enforcement           |
|-------------------|-----------------------------|-----------------------|
| Fan Registration  | Terms + Privacy Policy      | Checkbox (required)   |
| Talent Onboarding | NDA + Talent Agreement      | Scroll-to-read modal  |
| Booking Flow      | Experience Agreement        | Checkbox (required)   |
| Payment Page      | Sales Final Disclaimer      | Checkbox (required)   |
| Admin Login       | Internal Data Policy        | First-login modal     |

> ⚠️ All legal content in `src/data/legalContent.js` is **placeholder only**.
> Replace with lawyer-drafted content before going live.
> Contact: legal@crownpoint.com

---

## 🔌 Spring Boot API Endpoints

All service files are pre-wired. Backend dev replaces mock data with real calls.

```
Authentication
  POST   /api/auth/login
  POST   /api/auth/register

Talents
  GET    /api/talents
  GET    /api/talents/:id
  GET    /api/talents?category=Music

Orders
  POST   /api/orders
  GET    /api/orders/user/:userId
  GET    /api/orders/:orderId

Payments
  POST   /api/payments/submit          (multipart/form-data)
  GET    /api/payments/status/:orderId
  GET    /api/payments/instructions/:method

Admin
  GET    /api/admin/dashboard
  GET    /api/admin/payments/pending
  POST   /api/admin/payments/:id/approve
  POST   /api/admin/payments/:id/reject
  POST   /api/admin/payments/:id/flag

Users
  GET    /api/users/:id
  PUT    /api/users/:id
```

**To connect backend:** Change one line in `src/utils/api.js`:
```js
const BASE_URL = 'http://localhost:8080/api'  // development
const BASE_URL = 'https://api.crownpoint.com/api'  // production
```

---

## 🚀 Full Build Plan

| Step | Task                                      | Status     |
|------|-------------------------------------------|------------|
| 1    | Vite + React scaffold + dependencies      | ✅ Complete |
| 2    | Folder structure + all files created      | ✅ Complete |
| 3    | Global CSS variables, fonts, reset        | ✅ Complete |
| 4    | App.jsx + React Router + all routes       | ✅ Complete |
| 5    | Header component (floating, glass pill)   | 🔄 Next     |
| 6    | Footer component (4-column)               | ⏳ Pending  |
| 7    | Reusable UI components                    | ⏳ Pending  |
| 8    | Home — Hero section                       | ⏳ Pending  |
| 9    | Home — Featured Talents section           | ⏳ Pending  |
| 10   | Home — How It Works + Testimonials + CTA  | ⏳ Pending  |
| 11   | Talent Directory page                     | ⏳ Pending  |
| 12   | Talent Profile page                       | ⏳ Pending  |
| 13   | Booking / Chat Flow page                  | ⏳ Pending  |
| 14   | Payment page (3-tab system)               | ⏳ Pending  |
| 15   | Fan Dashboard                             | ⏳ Pending  |
| 16   | Admin Panel                               | ⏳ Pending  |
| 17   | Animations + scroll reveals               | ⏳ Pending  |
| 18   | Mobile responsiveness                     | ⏳ Pending  |
| 19   | Final review + cleanup                    | ⏳ Pending  |

---

## 🛠️ Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

> Requires Node.js v18+. Tested on Node v22.22.0 / npm 10.9.4

---

## 👥 Team

| Role              | Responsibility                          |
|-------------------|-----------------------------------------|
| Frontend Dev      | React UI — this repository              |
| Backend Dev       | Spring Boot API — separate repository  |
| Designer          | UI/UX — Figma (reference: HTML prototype) |
| Legal Counsel     | Draft all content in legalContent.js    |

---

*CrownPoint Limited — Confidential & Proprietary*
*Do not distribute without authorisation.*
