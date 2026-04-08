# Hotel Luggage Storage — Product Requirements Document

## 1. Overview

A mobile-first web application for hotel concierge/bellman staff to digitize the luggage storage process. Staff scan a physical luggage tag or manually enter guest information, photograph the luggage, and generate a digital voucher with QR code for the guest to claim their items.

**Target Users:**
- Primary: Hotel concierge / bellman staff (authenticated)
- Secondary: Hotel guests (unauthenticated, view-only voucher)

**Brand:** Hilton Hotels — uses Hilton brand colors (#002F61, #007293, #F0E9E6)

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.2.2 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | React 19, TailwindCSS 4 |
| Backend | Supabase (Auth, PostgreSQL, Storage) |
| OCR | GLM-OCR API (Zhipu BigModel) |
| QR Code | qrcode.react |
| Signature | signature_pad (reserved, not active in current flow) |

---

## 3. User Flow

```
Staff Login
    │
    ▼
Dashboard (view all records)
    │
    ▼ "Add Luggage"
New Check-In Wizard (4 steps)
    │
    ├─ Step 1: SCAN — Photograph luggage tag → OCR auto-extracts fields
    │          (or skip to manual entry)
    │
    ├─ Step 2: INFO — Review / edit extracted info (room, name, items, phone, notes)
    │
    ├─ Step 3: PHOTOS — Capture luggage photos
    │
    └─ Step 4: CONFIRM — Review all info → Submit
                │
                ▼
         Success Page + QR Code
                │
                ▼ (guest scans QR)
         Public Voucher Page (no auth required)
```

---

## 4. Pages & Routes

| Route | Auth | Purpose |
|-------|------|---------|
| `/login` | No | Staff email/password login |
| `/dashboard` | Yes | List all luggage records, logout |
| `/dashboard/new` | Yes | New check-in wizard (4 steps) |
| `/dashboard/success/[token]` | Yes | Post-submit success + QR code |
| `/dashboard/record/[id]` | Yes | Record detail view (staff) |
| `/voucher/[token]` | No | Guest-facing digital voucher |
| `/api/ocr` | Server | OCR processing endpoint |

---

## 5. Data Model

### 5.1 luggage_records

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto | Record ID |
| voucher_token | UUID | UNIQUE, auto | Token for guest voucher URL |
| guest_name | TEXT | DEFAULT '' | Guest name (optional) |
| room_number | TEXT | NOT NULL | Hotel room number |
| item_count | INTEGER | NOT NULL, DEFAULT 1 | Number of luggage items |
| phone | TEXT | nullable | Guest phone number |
| notes | TEXT | nullable | Staff notes / special instructions |
| signature_url | TEXT | nullable | URL to tag image (signature proof) |
| status | TEXT | 'stored' or 'collected' | Current luggage status |
| created_by | UUID | FK → auth.users | Staff member who created |
| created_at | TIMESTAMPTZ | NOT NULL, auto | Check-in timestamp |
| collected_at | TIMESTAMPTZ | nullable | Collection timestamp |

### 5.2 luggage_photos

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto | Photo ID |
| record_id | UUID | FK → luggage_records, CASCADE | Parent record |
| photo_url | TEXT | NOT NULL | Public URL in storage |
| uploaded_at | TIMESTAMPTZ | NOT NULL, auto | Upload timestamp |

### 5.3 Storage Buckets

| Bucket | Public | Purpose |
|--------|--------|---------|
| luggage-photos | Yes | Luggage item photos |
| signatures | Yes | Scanned tag images (signature proof) |

---

## 6. OCR Feature

### 6.1 Luggage Tag Fields (physical tag)

| Field | Regex-extracted | Stored in DB |
|-------|----------------|--------------|
| 房间号 / Room Number | ✅ | room_number |
| 客人姓名 / Guest Name | ✅ | guest_name |
| 行李数量 / Item Count | ✅ | item_count |
| 电话 / Phone | ✅ | phone |
| 寄存日期 / Storage Date | ✅ (parsed, not stored) | created_at (auto) |
| 领取日期 / Collection Date | ✅ (parsed, not stored) | collected_at (auto) |
| 客人签名 / Guest Signature | Visual on tag photo | signature_url (tag image) |
| 办理人签名 / Staff Signature | Visual on tag photo | — |

### 6.2 OCR Pipeline

1. Staff takes photo of luggage tag via device camera
2. Image uploaded to `/api/ocr` server route
3. Server converts image to base64 data URI
4. Server sends to GLM-OCR API (`/api/paas/v4/layout_parsing`, model: glm-ocr) — synchronous, no polling
5. Markdown text (`md_results`) parsed with regex to extract structured fields
6. Result returned to client → auto-fills form fields
7. Tag image URL preserved as signature proof

### 6.3 Design Decisions

- **No AI/LLM** for field extraction — regex only for simplicity and cost
- **Signatures are visual** — the physical tag already has handwritten signatures; no electronic signature step needed
- **All fields editable** — OCR results are pre-filled but staff can correct any field

---

## 7. Authentication & Security

- **Auth provider:** Supabase Auth (email/password)
- **Middleware:** Redirects unauthenticated users from `/dashboard/*` to `/login`
- **RLS:** Row Level Security on all tables — only authenticated users can read/write
- **Guest access:** SECURITY DEFINER functions (`get_record_by_token`, `get_photos_by_token`) bypass RLS for public voucher pages — scoped to specific voucher token only
- **API key:** `GLM_OCR_API_KEY` stored server-side in `.env.local`, never exposed to client

---

## 8. Non-Functional Requirements

| Requirement | Spec |
|-------------|------|
| Mobile-first | Optimized for phone/tablet use by staff |
| Bilingual | English + Chinese labels throughout |
| Offline | Not supported (requires network for Supabase + OCR) |
| Image size limit | 10MB per OCR upload |
| Photo storage | Supabase Storage, public URLs |
| Brand | Hilton palette: navy #002F61, turquoise #007293, offwhite #F0E9E6 |

---

## 9. File Structure

```
src/
  app/
    api/ocr/route.ts          — OCR server endpoint
    dashboard/
      page.tsx                 — Record list dashboard
      new/page.tsx             — 4-step check-in wizard
      record/[id]/page.tsx     — Record detail (staff)
      success/[token]/page.tsx — Post-submit + QR code
    login/page.tsx             — Staff login
    voucher/[token]/page.tsx   — Guest voucher (public)
    layout.tsx                 — Root layout
    page.tsx                   — Redirects to /dashboard
    globals.css                — Global styles
  components/
    PhotoCapture.tsx           — Camera/file capture for luggage photos
    LuggageTagScan.tsx         — Tag photo + OCR scan component
    SignaturePad.tsx            — Electronic signature (reserved)
  lib/
    types.ts                   — TypeScript interfaces
    supabase/
      client.ts                — Browser Supabase client
      server.ts                — Server Supabase client
  middleware.ts                — Auth redirect middleware
supabase/
  schema.sql                   — Full database schema
```

---

## 10. Environment Variables

| Variable | Scope | Description |
|----------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous key |
| `GLM_OCR_API_KEY` | Server only | GLM-OCR API key (Zhipu BigModel, https://open.bigmodel.cn) |

---

## 11. Future Considerations

- [ ] Collection flow — staff marks luggage as "collected" with timestamp
- [ ] Search/filter on dashboard (by room, date, status)
- [ ] Push notification when luggage is ready for pickup
- [ ] Multi-hotel / multi-property support
- [ ] Offline mode with sync
- [ ] Analytics — storage duration, volume trends
- [ ] Print physical voucher option
- [ ] Batch check-in for groups
