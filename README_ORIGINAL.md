# FarmRent — Agricultural Equipment Rental Portal

**FarmRent** is a peer-to-peer agricultural machinery rental portal designed to connect smallholder farmers with local equipment owners across rural India.

This project was built for college PBL (Problem-Based Learning) evaluation, using lightweight static web technologies (HTML5, Vanilla CSS, Vanilla JavaScript) integrated directly with Supabase (Authentication, PostgreSQL Database, and Row Level Security).

---

## 🌟 Key Features

1. **Farmer Experience**:
   - Equipment browsing with category filtering, daily pricing, and technical specs.
   - Dynamic booking request flow with real-time day calculation and flat ₹500 platform service fee.
   - **Dynamic Farmer Dashboard**: Displays real-time database counts (Pending, Approved, Completed, Paid Volume), upcoming bookings, and filterable rentals table.
   - **Interactive Demo Payment Checkout**: Clearly labeled demo simulation with itemized checkout summary, payment method choice, and simulated success/failure.
   - **Demo Payment Receipt**: Official itemized printable receipt with receipt number, transaction ID, and *PAID — DEMO SIMULATION* watermark.

2. **Equipment Owner Experience**:
   - Equipment listing management (Add, Mark Available/Unavailable, Delete).
   - Booking request management: Review farmer rental requests with individual **Accept** (`approved`), **Decline** (`rejected`), and **Mark Completed** (`completed`) actions.
   - Visual tracking of both **Booking Approval Status** and **Payment Status** (`Paid (Demo)` vs `Unpaid`), strictly maintaining state separation.
   - Owner earnings card: Tracks completed rental revenue minus platform service fee.

3. **Administrator Analytics Dashboard**:
   - **Registered Farmers & Owners**: Real database user counts.
   - **Equipment Listings & Total Bookings**: Overview of catalog and rental activity.
   - **Transaction Value Metrics**:
     - *Completed Bookings Value [Recorded]*: Actual recorded volume of completed rentals.
     - *Platform Commission [Estimate]*: Default 10% illustrative commission with transparent assumption labeling.
     - *Owner Share [Estimate]*: Completed value minus estimated platform facilitation share.
     - *Demo Paid Volume [Simulated]*: Total volume settled via the demo payment flow.
   - **Booking Status Breakdown**: Visual distribution bars for Pending, Approved, Completed, and Rejected requests.
   - **Monthly Booking Trend**: Month-over-month booking count and completed transaction value.
   - **Category Popularity**: Bookings distribution across Tractors, Harvesters, Rotavators, Sprayers, etc.
   - **Read-Only Data Tables**: Full administrative tables for Users and Equipment.
   - **Commission Rate Configuration**: Live adjustable commission rate (0% to 30%) with immediate recalculation.

---

## 🚀 Quick Start & Run Instructions

No npm installation or build step is required! The project runs as pure native web files.

### Option 1: Python Built-in Web Server (Recommended)
Open a terminal in the project folder and run:
```bash
python -m http.server 8000
```
Then open your browser and navigate to:
```
http://localhost:8000
```

### Option 2: VS Code Live Server
1. Open the project folder in Visual Studio Code.
2. Install the **Live Server** extension (by Ritwick Dey).
3. Right-click `index.html` and select **"Open with Live Server"**.

---

## 🗄️ Database Setup (Supabase)

The frontend is already pre-configured to communicate with the project's Supabase instance:
- **Supabase URL**: `https://hstqachutvwpqvdkmgkg.supabase.co`
- **Publishable Key**: `sb_publishable_JLx22E1slhwpVltr0IRekg_1pc0HElr`

### Executing the Migration

To enable the database-level admin aggregation function (`admin_overview`), admin read policies, and demo payment columns, execute the provided SQL migration:

1. Open your **Supabase Dashboard** -> **SQL Editor**.
2. Click **New Query**.
3. Copy and paste the contents of `supabase/migrations/001_admin_and_security.sql`.
4. Click **Run**.

*Note: The frontend includes resilient fallback aggregation. Even before the migration is applied, the admin dashboard will gracefully compute metrics directly from accessible database rows.*

---

## 🛡️ Administrative Access Provisioning

Admin privileges must be assigned through a controlled administrative process, never through public signup.

### How to Grant Admin Access to an Account:
1. Register an account through the app signup modal (or use an existing account email).
2. Open the **Supabase Dashboard -> SQL Editor** and run:
```sql
-- Step 1: Insert user into public.admins table
INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Step 2: Update role in public.profiles table
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'YOUR_EMAIL@example.com';
```
3. Log in with that email and password through the login modal. The application will immediately recognize the administrator privileges and route you to the **Admin Dashboard** (`#page-admin`).

---

## 💳 Payment Gateway Evaluation & Architecture

### Why a Local Demo Payment Simulator was Chosen

During technical evaluation, integrating external payment sandboxes (such as Razorpay Test Mode or Stripe Sandbox) was analyzed:
1. **Serverless Architecture**: Real payment gateway sandboxes require a secure backend server (Node.js/Python/Go) to securely handle server-side API secrets and cryptographic webhook signature verification (`razorpay_signature` / `stripe-signature`). Without a backend server, gateway API keys would be exposed in client-side code, creating a critical vulnerability.
2. **Merchant Onboarding & Domain Verification**: Modern payment gateways require active merchant onboarding, GST/PAN documentation, and publicly accessible HTTPS domains with valid SSL certificates, which is impractical for an offline/local college PBL prototype.
3. **PBL Presentation Compliance**: A local, deterministic demo payment flow ensures 100% reliable demonstrations during evaluations without external network latency, third-party sandbox downtime, or banking simulator failures.

### Key Implementation Safeguards:
- **Prominent Disclaimers**: Unmissable **DEMO PAYMENT — NO REAL MONEY** badges and banners prevent user confusion.
- **Zero Real Credentials Collected**: No CVV, PIN, or real banking passwords are ever requested or stored.
- **Independent State Separation**: A booking being marked `completed` by an owner does NOT automatically mean payment was received. Payment status (`paid`, `unpaid`, `failed`) is tracked as a distinct state.
- **Itemized Receipts**: Automatically generates a demo receipt with transaction reference (`TXN-DEMO-SIM-...`) and receipt number (`FR-REC-...`) with print support.

---

## 📁 Project Structure

```
FarmRent/
├── index.html                   # Core single-page application structure & modals
├── script.js                    # Application logic, Supabase client, auth & payment engine
├── style.css                    # Complete design system with FarmRent earthy theme
├── README.md                    # Project documentation & run guide
├── CHANGELOG.md                 # Detailed changelog of all additions
├── TEST_CHECKLIST.md            # Step-by-step manual testing protocol
└── supabase/
    └── migrations/
        └── 001_admin_and_security.sql   # SQL migration for Admin RPC & payment columns
```

---

## 👥 Roles & Workflows

| Role | Primary Functions |
|---|---|
| **Farmer** | Browse catalog, view equipment specs, calculate rental pricing, submit booking requests, review active/completed rentals, simulate demo payments, generate and print receipts. |
| **Owner** | List agricultural machinery, set daily pricing and specs, review incoming farmer booking requests (Accept / Decline / Complete), track earnings minus service fees. |
| **Admin** | Review platform-wide analytics, monitor farmer/owner user counts, equipment listings, booking status distribution, monthly rental trends, category popularity, and adjust platform commission estimate rate. |
