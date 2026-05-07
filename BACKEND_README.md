# CrownPoint Backend Build Guide

This document is the implementation guide for the backend developer building the real backend for the CrownPoint site in this repository.

Right now the frontend is a polished demo app backed mostly by browser storage. The backend job is to replace that local-only persistence with a real API, real authentication, real uploads, real admin workflows, and a clean migration path that does not force a frontend rewrite.

The frontend already has a strong service-layer split, so the easiest win is to preserve the current data shapes as much as possible and swap the storage source from local storage to HTTP.

## 1. What CrownPoint Actually Does

CrownPoint is a premium celebrity-access and concierge booking platform with these active flows:

1. Public visitors browse premium talent profiles, services, events, and shop items.
2. Fans create accounts, upload profile and verification images, and accept a confidentiality agreement.
3. Fans book services, buy event tickets, and build one-talent shop carts from artist shop pages.
4. Shop checkout now starts from a header cart tray on shop pages and continues into a ref-code-driven payment screen.
5. Fans submit payment proof using bank transfer, gift cards, or crypto.
6. Fans apply for paid memberships:
   - `INNER_CIRCLE` for one selected talent
   - `CROWN_ACCESS` for platform-wide messaging access
7. Admin reviews payment submissions and membership requests.
8. Admin manages the live talent roster, services, events, shop items, review aggregates, and payment settings.
9. Fans and admin use talent inboxes for private messaging once membership access is active.
10. Fan messaging is now split into a thread-list screen and a dedicated thread-detail screen.

Important product note:

The public review display card was removed from the talent profile UI, but review submission still exists. The backend must still persist reviews, keep aggregate `rating` and `reviewCount` updated, and make review entries available to internal/admin tools.

Important UX note:

The frontend now opens private messages in two steps:

1. `/messages` shows unlocked threads only.
2. `/messages/:threadId` shows the actual message box for one thread.
3. `/talent/:id/messages` is a talent-specific launch point that should be able to jump directly into the correct unlocked thread.

## 2. Routes And Product Areas In The Frontend

These routes are currently live in `src/App.jsx` and should be treated as the product surface area the backend must support:

- `/` - marketing home page
- `/talents` - public talent directory
- `/talent/:id` - talent profile
- `/talent/:id/events` and `/events` - event browsing and ticket purchase
- `/talent/:id/shop` - talent shop, header cart tray, and merchandise checkout entry
- `/talent/:id/messages` - talent-specific direct message access and inbox launch
- `/talent/:id/reviews` - talent reviews and review submission
- `/book` - service booking brief
- `/payment` - payment submission and proof upload
- `/pricing` - membership pricing entry
- `/membership` - membership application and payment-proof submission
- `/auth` - fan sign-in and sign-up
- `/admin-login` - admin sign-in
- `/dashboard` - fan dashboard
- `/messages` - unlocked thread list for fan messaging
- `/messages/:threadId` - dedicated fan message box for one thread
- `/admin` - admin desk for payments, memberships, inboxes, talent management, and payment settings
- `/legal` - legal content

## 3. Current Frontend Data Sources You Are Replacing

These are the current storage seams:

| Area | Current file(s) | Current storage |
|---|---|---|
| Auth, session, user profile | `src/services/authService.js` | `localStorage` |
| User account edits | `src/services/userService.js` | `localStorage` |
| Talent catalog and admin CRUD | `src/data/talents.js`, `src/services/talentService.js` | `localStorage` plus seeded defaults |
| Orders and payment review | `src/services/orderService.js` | `localStorage` |
| Membership requests | `src/services/membershipService.js` | `localStorage` |
| Private messaging | `src/services/messageService.js` | `localStorage` |
| Message attachments | `src/services/messageAttachmentService.js` | `IndexedDB` |
| Shop cart and draft checkout state | `src/context/CartContext.jsx`, `src/context/OrderContext.jsx` | In-memory React state |
| Currency-specific payment settings | `src/services/paymentSettingsService.js` | `localStorage` |
| Signup avatar and verification uploads | `src/services/devUploadService.js` | `localStorage` |
| Dev-only mirrored signup records | `src/services/devSignupRecordService.js` | `localStorage` |

Important:

1. `src/utils/api.js` already exists and should become the shared HTTP client once the backend is ready.
2. The frontend already expects asynchronous service calls, so you can migrate feature-by-feature without redesigning the pages.
3. `CartContext` and `OrderContext` currently hold the active shop cart and checkout draft only in memory. The backend does not have to persist carts in v1, but once an order exists the API must become the durable source of truth for `refCode` lookups.
4. The backend should replace the dev-only signup record mirror with real persistence and audit logging, not plaintext file dumps.

## 4. Non-Negotiable Enums And Status Values

Do not rename these unless the frontend is updated at the same time.

### Roles

- `FAN`
- `TALENT`
- `ADMIN`

### Contact methods

- `EMAIL`
- `PHONE`
- `WHATSAPP`

### Identity verification status

- `NOT_SUBMITTED`
- `PENDING_REVIEW`
- `VERIFIED`
- `FLAGGED`

### Payment methods

- `BANK_TRANSFER`
- `GIFT_CARD`
- `CRYPTO`

### Order types

- `SERVICE`
- `TICKET`
- `SHOP`

### Order status

- `PENDING_PAYMENT`
- `UNDER_REVIEW`
- `FLAGGED`
- `PAID`
- `IN_PROGRESS`
- `COMPLETED`
- `FAILED`
- `CANCELLED`

### Membership plans

- `FREE`
- `INNER_CIRCLE`
- `CROWN_ACCESS`

### Membership billing cycles

- `MONTHLY`
- `YEARLY`

### Membership request status

- `UNDER_REVIEW`
- `APPROVED`
- `REJECTED`
- `FLAGGED`

## 5. Recommended Backend Stack

This frontend is already shaped well for a Spring backend. Recommended stack:

1. Spring Boot 3.3+
2. Java 21
3. PostgreSQL 16+
4. Spring Security
5. JWT access tokens
6. Flyway
7. Spring Validation
8. MapStruct or manual DTO mapping
9. S3-compatible object storage for uploads
10. Redis optional later, not required for first release

## 6. How The Backend Developer Should Build This

Build the backend in this order. Do not start with everything at once.

### Phase 1: Bootstrap the project

1. Create a separate Spring Boot project.
2. Add modules for `auth`, `users`, `talents`, `orders`, `memberships`, `messages`, `payment-settings`, `uploads`, and `admin`.
3. Add JWT auth, role-based authorization, and Flyway from day one.
4. Add OpenAPI or Swagger so frontend and backend can stay aligned.

### Phase 2: Implement auth and user profile first

Build these first because most protected flows depend on them:

1. Fan registration
2. Fan login
3. Admin login
4. Current user endpoint
5. User profile update
6. User account update
7. User deletion
8. Verification document persistence

Do this before orders, memberships, or messaging.

### Phase 3: Move the talent catalog next

Replace `src/data/talents.js` with API-backed catalog reads and admin CRUD:

1. Get all talents
2. Get one talent
3. Filter/search talents
4. Admin create/update/delete talent
5. Admin create/update/delete services
6. Admin create/update/delete events and ticket tiers
7. Admin create/update/delete shop items
8. Fan review submission

### Phase 4: Build order creation and payment proof review

After auth and talent data are stable:

1. Create service, ticket, and shop orders
2. Preserve one-talent shop-cart rules and persist full item lines with quantity, variant or size, unit price, and line totals
3. Persist checkout contact and shipping address
4. Persist payment method and payment proof metadata
5. Expose user order history
6. Expose admin payment queue
7. Allow admin approve/reject/flag

Important:

`GET /api/orders/ref/{refCode}` must be enough to rebuild the payment screen for `SERVICE`, `TICKET`, and `SHOP` orders. The shop payment UI now depends heavily on that ref-code hydration path.

### Phase 5: Build memberships and access activation

1. Submit membership request
2. Persist payment proof for membership
3. Expose fan membership request history
4. Expose admin membership review queue
5. On approval, update the user:
   - `plan`
   - `planExpiry`
   - `planBillingCycle`
   - `talentsUnlocked`

### Phase 6: Build messaging and attachments

1. Thread listing for fan inbox route
2. Single-thread fetch for dedicated thread-detail route
3. Thread lookup or filter by current user plus talent for direct talent-page launch
4. Thread listing per talent for admin
5. Send fan message
6. Send admin/talent reply
7. Attachment uploads for image/audio/pdf/docx
8. Auto-provision message access after membership approval

### Phase 7: Build payment settings by currency

This powers the Payment and Membership pages and the admin settings desk.

1. CRUD bank transfer instructions
2. CRUD accepted gift card brands
3. CRUD crypto assets and wallet networks
4. Save revision metadata per currency

### Phase 8: Remove demo persistence

Only after endpoints are stable:

1. Replace frontend local-storage services with API calls
2. Remove seeded browser-state assumptions
3. Keep frontend data shapes stable where possible

## 7. Suggested Package Layout

```text
com.crownpoint
  config
  security
  common
  auth
  user
  talent
  order
  membership
  message
  paymentsettings
  upload
  admin
```

Within each module:

- `controller`
- `service`
- `repository`
- `domain`
- `dto`
- `mapper`

## 8. Core Domain Model

Recommended database model:

### Users

- `users`
- `user_profiles`
- `user_memberships`
- `user_verification_documents`
- `user_agreements`

### Talents

- `talents`
- `talent_services`
- `talent_events`
- `event_ticket_tiers`
- `talent_shop_items`
- `talent_reviews`

### Orders

- `orders`
- `order_items`
- `order_contacts`
- `order_shipping_addresses`
- `order_payment_submissions`

### Memberships

- `membership_requests`

### Messaging

- `message_threads`
- `messages`
- `message_attachments`

### Payment settings

- `payment_currency_settings`
- `payment_bank_details`
- `payment_gift_cards`
- `payment_crypto_assets`
- `payment_crypto_networks`

### Upload and audit support

- `stored_files`
- `admin_audit_logs`

## 9. Critical Product Rules To Preserve

### Auth

1. Fan signup requires:
   - name
   - email
   - password
   - phone
   - date of birth
   - country
   - NDA/confidentiality agreement acceptance
2. Signup currently also supports:
   - avatar image
   - government ID front
   - government ID back
   - SSN or tax ID image
3. The demo stores passwords in local storage only because it is mock auth.
4. Real backend must hash passwords with BCrypt or Argon2.
5. Never persist plaintext passwords in production.

### Reviews

1. Public talent pages still use aggregate review stats on cards and profile meta.
2. Public review list UI was removed from the talent profile page.
3. Review submission is still live.
4. Backend must:
   - store the review entry
   - prevent duplicate reviews from the same user per talent
   - keep `rating` and `reviewCount` in sync
   - expose raw reviews to admin/internal tools

### Completed experiences

Admin now manually edits `completedBookings` for each talent. Treat this as a first-class persisted talent field.

### Membership unlocks

1. `INNER_CIRCLE` unlocks one selected talent
2. `CROWN_ACCESS` unlocks all talent messaging
3. Approving a membership request should update the user record immediately

### Shop checkout

1. Shop carts are talent-specific. A fan can only have one active talent cart at a time.
2. Shop checkout is launched from a header cart tray, not an inline summary sidebar.
3. Backend order persistence must preserve shop line items exactly as selected, including quantity, selected size or variant, unit price, and line total.
4. The payment page must be able to rehydrate a shop order from the backend by `refCode` even if the client-side draft cart is gone.

### Payment settings

The app supports per-currency payment setup for:

- `USD`
- `GBP`
- `EUR`
- `CAD`
- `AUD`
- `AED`

Each currency has:

1. bank transfer reference prefix
2. bank instructions
3. bank detail rows
4. accepted gift card brands
5. crypto assets
6. crypto networks and wallet addresses
7. update metadata:
   - `updatedAt`
   - `updatedBy`
   - `revision`

### Messaging

1. `/messages` is now a thread-list screen only.
2. `/messages/:threadId` is the dedicated message-box screen.
3. Talent profile messaging links should be able to open the correct existing thread directly.
4. Threads are fan-to-talent, one thread per fan/talent pairing.
5. Admin currently replies as the talent from the admin desk.
6. Attachments support:
   - images
   - audio
   - pdf
   - docx

## 10. Endpoint Map The Frontend Will Need

You do not have to use these exact controller names, but the backend should cover these capabilities.

### Auth and session

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/admin/login`
- `GET /api/auth/me`
- `POST /api/auth/logout` optional

### User account

- `GET /api/users/me`
- `PATCH /api/users/me/profile`
- `PATCH /api/users/me/account`
- `DELETE /api/users/me`

### Talents and public catalog

- `GET /api/talents`
- `GET /api/talents/{id}`
- `GET /api/talents/featured`
- `GET /api/talents/search?q=...`
- `GET /api/talents?category=...`
- `GET /api/events/upcoming`

### Talent reviews

- `POST /api/talents/{id}/reviews`
- `GET /api/admin/talents/{id}/reviews`

### Admin talent management

- `POST /api/admin/talents`
- `PATCH /api/admin/talents/{id}`
- `DELETE /api/admin/talents/{id}`
- `POST /api/admin/talents/{id}/services`
- `PATCH /api/admin/talents/{id}/services/{serviceId}`
- `DELETE /api/admin/talents/{id}/services/{serviceId}`
- `POST /api/admin/talents/{id}/events`
- `PATCH /api/admin/talents/{id}/events/{eventId}`
- `DELETE /api/admin/talents/{id}/events/{eventId}`
- `POST /api/admin/talents/{id}/shop-items`
- `PATCH /api/admin/talents/{id}/shop-items/{shopItemId}`
- `DELETE /api/admin/talents/{id}/shop-items/{shopItemId}`

### Orders and payments

- `POST /api/orders`
- `GET /api/orders/me`
- `GET /api/orders/ref/{refCode}`
- `POST /api/orders/{id}/payment-submissions`
- `GET /api/admin/orders/payment-queue`
- `PATCH /api/admin/orders/{id}/status`

For `SHOP` orders, the order payload returned by create and lookup endpoints should include line items, item labels, contact details, shipping details, and payment metadata so the payment screen can render without relying on client memory.

### Memberships

- `POST /api/memberships/requests`
- `GET /api/memberships/requests/me`
- `GET /api/admin/memberships/queue`
- `PATCH /api/admin/memberships/{id}/status`

### Messaging

- `GET /api/messages/threads/me`
- `GET /api/messages/threads/me?talentId={talentId}` recommended for direct talent-page launch
- `GET /api/messages/threads/{threadId}`
- `POST /api/messages/threads/{threadId}/fan-messages`
- `POST /api/admin/messages/threads/{threadId}/talent-messages`
- `GET /api/admin/talent-inboxes`
- `GET /api/admin/talents/{talentId}/threads`

### Payment settings

- `GET /api/payment-settings/{currencyCode}`
- `PATCH /api/admin/payment-settings/{currencyCode}`
- `POST /api/admin/payment-settings/{currencyCode}/reset` optional

### Uploads

Use either multipart uploads or signed-upload URLs. Backend must support:

- signup avatar upload
- signup verification document uploads
- order payment proof upload
- membership proof upload
- message attachments

## 11. Response Shapes The Frontend Already Expects

### Auth response

```json
{
  "token": "jwt-token",
  "user": {
    "id": 17,
    "name": "Amara Okafor",
    "email": "amara@example.com",
    "role": "FAN",
    "avatarUrl": "https://cdn.example.com/users/17/avatar.jpg",
    "initials": "AO",
    "createdAt": "2026-04-10T08:00:00Z",
    "profileUpdatedAt": "2026-04-10T08:00:00Z",
    "profile": {
      "phone": "+14045550182",
      "dateOfBirth": "1996-03-14",
      "city": "Atlanta",
      "country": "United States",
      "countryCode": "US",
      "phoneDialCode": "+1",
      "bio": "Entertainment enthusiast...",
      "admirationReason": "I admire how...",
      "hobbies": "Travel, fashion...",
      "interests": "Music rollouts...",
      "favoriteTalent": "Bruno Mars",
      "occupation": "Brand partnerships manager",
      "preferredContactMethod": "PHONE"
    },
    "verification": {
      "status": "PENDING_REVIEW",
      "submittedAt": "2026-04-10T08:00:00Z",
      "ageVerifiedAt": "2026-04-10T08:00:00Z",
      "isAdultVerified": true,
      "documents": {
        "idFront": {
          "uploadId": "upload-1",
          "fileName": "id-front.jpg",
          "mimeType": "image/jpeg",
          "storagePath": "users/17/verification/id-front.jpg",
          "uploadedAt": "2026-04-10T08:00:00Z"
        },
        "idBack": {
          "uploadId": "",
          "fileName": "",
          "mimeType": "",
          "storagePath": "",
          "uploadedAt": null
        },
        "ssn": {
          "uploadId": "",
          "fileName": "",
          "mimeType": "",
          "storagePath": "",
          "uploadedAt": null
        }
      }
    },
    "plan": "INNER_CIRCLE",
    "planExpiry": "2026-05-10T08:00:00Z",
    "planBillingCycle": "MONTHLY",
    "talentsUnlocked": [5]
  }
}
```

### Talent shape

```json
{
  "id": 1,
  "name": "Bruno Mars",
  "category": "Music",
  "subcategory": "R&B / Pop",
  "initials": "BM",
  "bio": "Artist bio...",
  "location": "Las Vegas, USA",
  "responseTime": "24h",
  "rating": 4.9,
  "reviewCount": 2418,
  "completedBookings": 2418,
  "startingPrice": 299,
  "available": true,
  "verified": true,
  "gradient": "linear-gradient(...)",
  "avatarUrl": "https://cdn.example.com/talents/1/avatar.jpg",
  "languages": ["English"],
  "tags": ["Grammy Winner", "World Tour"],
  "services": [],
  "events": [],
  "shopItems": [],
  "reviews": []
}
```

### Order shape

```json
{
  "id": 9001,
  "userId": 17,
  "fanName": "Amara Okafor",
  "email": "amara@example.com",
  "orderType": "SHOP",
  "talent": {
    "id": 7,
    "name": "LeBron James"
  },
  "talentName": "LeBron James",
  "itemLabel": "2 selected shop items",
  "refCode": "A92KX",
  "totalPrice": 899,
  "status": "UNDER_REVIEW",
  "paymentMethod": "BANK_TRANSFER",
  "paymentProof": "receipt.jpg",
  "paymentProofFileName": "receipt.jpg",
  "giftCardBrand": "",
  "cryptoAsset": "",
  "cryptoNetwork": "",
  "items": [
    {
      "lineId": "hoodie-1::XL",
      "id": "hoodie-1",
      "type": "APPAREL",
      "title": "Crown Tour Hoodie",
      "subtitle": "Size XL",
      "quantity": 2,
      "unitPrice": 449.5,
      "totalPrice": 899,
      "selectedSize": "XL",
      "stock": 12
    }
  ],
  "contact": {
    "fullName": "Amara Okafor",
    "email": "amara@example.com",
    "phone": "+14045550182"
  },
  "shippingAddress": {
    "recipient": "Amara Okafor",
    "countryCode": "US",
    "country": "United States",
    "addressLine1": "123 Peach Tree Ave",
    "addressLine2": "Suite 5B",
    "city": "Atlanta",
    "stateOrRegion": "Georgia",
    "postalCode": "30303",
    "deliveryNotes": "Front desk drop-off"
  },
  "proofSummary": "Payment proof uploaded: receipt.jpg.",
  "region": "United States",
  "risk": "low",
  "createdAt": "2026-04-10T08:00:00Z",
  "submittedAt": "2026-04-10T08:05:00Z",
  "reviewedAt": null
}
```

### Membership request shape

```json
{
  "id": 301,
  "userId": 17,
  "fanName": "Amara Okafor",
  "email": "amara@example.com",
  "plan": "INNER_CIRCLE",
  "billingCycle": "MONTHLY",
  "talentId": 5,
  "talentName": "Kai Cenat",
  "amountUsd": 500,
  "currencyCode": "GBP",
  "region": "United Kingdom",
  "paymentMethod": "BANK_TRANSFER",
  "proofSummary": "Transfer receipt uploaded...",
  "proofFileName": "proof.jpg",
  "submittedAt": "2026-04-10T08:00:00Z",
  "reviewedAt": null,
  "activatedAt": null,
  "status": "UNDER_REVIEW",
  "risk": "low"
}
```

### Message thread shape

```json
{
  "id": "thread-17-5",
  "fanUserId": 17,
  "fanName": "Amara Okafor",
  "fanEmail": "amara@example.com",
  "talentId": 5,
  "talentName": "Kai Cenat",
  "topic": "Inner Circle inbox",
  "preview": "Thanks for reaching out...",
  "createdAt": "2026-04-10T08:00:00Z",
  "lastActiveAt": "2026-04-10T08:10:00Z",
  "messages": [
    {
      "id": "thread-17-5-fan-1",
      "senderRole": "fan",
      "senderLabel": "Amara Okafor",
      "text": "Hey Kai...",
      "attachments": [],
      "createdAt": "2026-04-10T08:10:00Z"
    }
  ]
}
```

### Payment settings shape

```json
{
  "currencyCode": "USD",
  "bank": {
    "referencePrefix": "CP",
    "instructions": "Include your reference code.",
    "details": [
      { "id": "bank-account-name", "label": "Account Name", "value": "CrownPoint LLC" }
    ]
  },
  "giftCards": [
    { "id": "amazon", "label": "Amazon Gift Card" }
  ],
  "cryptoAssets": [
    {
      "id": "usdt",
      "label": "USDT",
      "networks": [
        { "id": "erc20", "label": "Ethereum (ERC-20)", "wallet": "0x..." }
      ]
    }
  ],
  "meta": {
    "updatedAt": "2026-04-10T08:00:00Z",
    "updatedBy": "admin@crownpoint.local",
    "revision": 3
  }
}
```

## 12. Upload Strategy

The site currently has upload-like flows in five places:

1. signup avatar
2. signup ID front
3. signup ID back
4. signup SSN / tax ID image
5. order payment proof
6. membership payment proof
7. message attachments

Recommended backend approach:

1. Store file metadata in PostgreSQL.
2. Store binary files in S3-compatible object storage.
3. Return `uploadId`, `fileName`, `mimeType`, `storagePath`, and `uploadedAt`.
4. For private assets, use signed download URLs.
5. For payment proof and identity files, keep access restricted to admin/staff.

Accepted attachment types for messages should remain:

- images
- audio
- pdf
- docx

## 13. Security Requirements

Do not skip these:

1. Hash passwords. Never store plaintext passwords.
2. Secure all admin endpoints with `ADMIN` role checks.
3. Secure fan-only endpoints with authenticated `FAN` or `ADMIN`.
4. Restrict thread access so a fan can only see their own threads.
5. Restrict talent/admin thread views by role.
6. Restrict verification docs, SSN images, payment proofs, and private attachments.
7. Add audit logs for:
   - payment review decisions
   - membership approvals and rejections
   - payment settings edits
   - talent CRUD

## 14. Migration Notes For The Frontend

When you wire the API into the frontend:

1. Replace the storage logic inside the service files first.
2. Do not rewrite the pages unless the response shape truly requires it.
3. Keep these seams stable:
   - `authService`
   - `userService`
   - `talentService`
   - `orderService`
   - `membershipService`
   - `messageService`
   - `paymentSettingsService`
4. Use `src/utils/api.js` as the shared Axios client.
5. Keep `token` plus nested `user` in auth responses so `AuthContext` stays simple.

## 15. Suggested Environment Variables

```env
SPRING_PROFILES_ACTIVE=dev
SERVER_PORT=8080

DB_URL=jdbc:postgresql://localhost:5432/crownpoint
DB_USERNAME=crownpoint
DB_PASSWORD=change-me

JWT_SECRET=change-me
JWT_ACCESS_TTL_MINUTES=1440

CORS_ALLOWED_ORIGINS=http://localhost:5173

STORAGE_BUCKET=crownpoint-dev
STORAGE_REGION=us-east-1
STORAGE_ENDPOINT=http://localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin

APP_PUBLIC_BASE_URL=http://localhost:5173
```

## 16. Build Acceptance Checklist

The backend is ready for frontend integration when all of the following work:

1. Fan can register, log in, and persist session.
2. Signup avatar and verification files upload and are linked to the user.
3. User profile can be edited from dashboard.
4. Public talents load from API.
5. Admin can create, edit, and delete talents, services, events, and shop items.
6. Admin can manually edit `completedBookings`.
7. Fan can submit a review and backend updates aggregate stats.
8. Fan can create service, ticket, and shop orders.
9. Shop orders preserve one-talent cart rules and can be rehydrated by `refCode`.
10. Fan can submit payment proof.
11. Admin payment queue can approve, reject, and flag orders.
12. Fan can submit membership request with proof.
13. Admin membership queue can approve, reject, and flag requests.
14. Membership approval updates user access immediately.
15. Fan can see unlocked messaging threads on `/messages`.
16. Fan can open `/messages/:threadId` and send messages with attachments.
17. Talent-page direct-message launch opens the correct unlocked thread.
18. Admin can reply from the talent inbox view.
19. Admin can manage payment settings per currency.
20. All protected endpoints enforce JWT auth and role checks.

## 17. Final Guidance

Build this backend as the permanent source of truth for CrownPoint, not as a thin wrapper around the demo storage model.

The current frontend is already opinionated about the product:

- premium talent discovery
- service booking
- ticketing
- shop checkout with one-talent carts and ref-code payment recovery
- proof-based payments
- membership-gated messaging with separate inbox-list and thread-detail routes
- admin moderation and finance review
- per-currency payment operations

If you preserve those contracts and ship in the phase order above, the frontend migration will stay controlled and low-risk.
