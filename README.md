# Lubriplate Supplier Compliance Portal

A full-stack web application for Lubriplate Lubricants Company where external suppliers submit compliance information.

## Features

### Public Supplier Form (No Login Required)
- **Step 1 — Company Information**: Company details + dynamic product list (Food Grade / Industrial)
- **Step 2 — Compliance & Certifications**: PFAS/MoaH toggles, SDS/TDS uploads, Kosher/Halal/NSF certifications (conditional on Food Grade)
- **Step 3 — Allergen Table**: 14-allergen matrix per Food Grade product (skipped automatically for Industrial-only suppliers)
- **Step 4 — Declaration & Signature**: Legal declaration, drawn signature pad, authorisation checkbox
- **Confirmation Page**: Reference number, confirmation email notice

### Internal Admin Dashboard (Login Required)
- Login: `admin` / `lubriplate2025`
- Submission table with filtering (status, date range, product type, search)
- Color-coded status badges (Submitted / Under Review / Approved / Rejected)
- Full submission detail view with file download links, allergen tables, signature image
- Status management dropdown
- Export to CSV or Excel

## Tech Stack
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Frontend**: React + Vite
- **File Storage**: Local `/uploads` folder, organized by submission ID
- **Authentication**: JWT tokens
- **Emails**: Nodemailer (test via Ethereal in dev, configure SMTP for production)
- **Signature**: signature_pad.js

## Quick Start

### 1. Install all dependencies
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 2. Start the backend (port 3001)
```bash
cd backend
cp .env.example .env
npm run dev
```

### 3. Start the frontend (port 5173)
```bash
cd frontend
npm run dev
```

### 4. Access the app
- **Supplier Form**: http://localhost:5173
- **Admin Dashboard**: http://localhost:5173/admin/login

## Production Deployment

### Build frontend
```bash
cd frontend && npm run build
```

### Run backend (serves built frontend)
```bash
cd backend
NODE_ENV=production node server.js
```

The backend will serve the React app from `../frontend/dist` at port 3001.

## Database
SQLite database is stored at `backend/lubriplate.db`. Tables:
- `SupplierSubmissions` — one row per submission
- `SupplierProducts` — child table linked to submissions
- `SupplierAllergens` — child table linked to products

## File Storage
Uploaded files are stored in `backend/uploads/[submission-id]/` organized as:
- `kosher_cert.*` — Kosher certificate
- `halal_cert.*` — Halal certificate
- `signature.png` — Drawn signature
- `[product-name]/sds.*` — Safety Data Sheet
- `[product-name]/tds.*` — Technical Data Sheet
- `[product-name]/nsf_cert.*` — NSF certificate

## Email Configuration
In development, emails are sent via Ethereal (fake SMTP). Check the console for preview URLs.

For production, set SMTP environment variables in `.env`:
```
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=your_password
```

Emails are sent to:
- **Supplier**: Confirmation with reference number
- **Quality Team** (quality@lubriplate.com): New submission notification with dashboard link

## Branding
- Primary: `#1A1A1A` (black)
- Accent: `#CC0000` (red)
