# Changelog — FarmRent PBL Final Sprint

All notable changes made to the FarmRent application during this completion sprint are documented below.

---

### [2.0.0] - Final PBL Presentation Release

#### Added — Task 1: Admin Analytics Dashboard
- **Admin Page Section (`#page-admin`)**: Added complete multi-section administrative interface (Overview, Users, Equipment, Commission Setting).
- **Core Analytics Metrics**:
  - Registered Farmers and Registered Owners from `public.profiles`.
  - Total Equipment Listings from `public.equipment`.
  - Total Booking Requests from `public.booking_requests`.
  - Completed Bookings Value: Total transaction value of rentals marked completed.
  - Platform Commission Estimate: Illustrative platform commission (default 10%) labeled with transparent calculation assumptions.
  - Owner Share Estimate: Net owner earnings calculated as completed value minus estimated platform commission.
  - Demo Paid Volume: Total volume settled through the demo payment simulator.
- **Visual Analytics Charts**:
  - Horizontal status breakdown progress bars (Pending, Approved, Completed, Rejected).
  - Monthly booking activity and completed transaction volume trend bars.
  - Equipment category popularity distribution bars.
- **Read-Only Management Overviews**:
  - Users Overview Table (Name, Email, Phone, Role).
  - Equipment Listings Table (Equipment Name, Category, Owner Name, Daily Rate, Availability Status).
- **Interactive Commission Setting**: Commission rate slider (0% to 30%) with immediate recalculation of platform commission and owner share estimates.
- **Dual-Path Admin Authorization**: Updated `fetchProfileForUser()` to recognize administrators through either the `public.admins` table or `profiles.role = 'admin'`.
- **Resilient Fallback Engine**: If the database RPC function `admin_overview` has not been applied yet, `loadAdminDashboard()` automatically falls back to client-side direct table aggregation to render real analytics without UI failure.

#### Added — Task 2: Demo Payment Flow
- **Demo Payment Modal (`#demoPaymentModalOverlay`)**:
  - Unmissable bold warning banner: **DEMO PAYMENT — NO REAL MONEY** explaining that this is a simulated academic environment.
  - Itemized Checkout Summary displaying equipment thumbnail, name, rental date range, duration in days, daily rate subtotal, platform service fee (₹500 flat), and total amount payable.
  - Simulated Payment Method Selector (Demo UPI / QR, Demo Card / NetBanking Sandbox, Demo Pay on Delivery).
  - Realistic simulated payment gateway authorization spinner animation.
  - Simulated **Payment Success** outcome (`executeDemoPayment(true)`).
  - Simulated **Payment Failure** outcome (`executeDemoPayment(false)`) displaying a realistic bank timeout / simulated decline alert.
- **Demo Payment Receipt Modal (`#demoReceiptModalOverlay`)**:
  - Clean, official receipt card with unique Receipt Number (`FR-REC-YYYY-XXXXX`), Transaction Reference (`TXN-DEMO-SIM-XXXXXX`), timestamp, farmer details, equipment rental breakdown, and platform fee.
  - Prominent **PAID — DEMO SIMULATION** watermark stamp.
  - Integrated browser print button (`window.print()`).
- **Payment State Architecture**:
  - Payment status (`paid`, `unpaid`, `failed`) is strictly decoupled from booking approval status (`pending`, `approved`, `completed`, `rejected`).
  - Owner completion of a rental does not alter payment status.
  - Multi-tier state persistence: LocalStorage cache (`farmrent_demo_payments_v1`) provides immediate zero-latency presentation reliability, while asynchronous Supabase updates persist payment records when the migration is active.

#### Added — Farmer Dashboard Upgrade (Fixing Mock Data & Dead Links)
- **Dynamic Supabase Integration (`loadFarmerDashboard()`)**: Replaced all hardcoded mock numbers (2 active, 1 upcoming, 7 completed, ₹18,400) with dynamic calculations from `booking_requests`.
- **Next Scheduled Rental Card**: Dynamically displays the farmer's next upcoming booking with direct action buttons (`Pay Now (Demo)` or `View Demo Receipt`).
- **Filterable Rentals Table**: Real-time table displaying Equipment, Dates, Duration, Amount, Booking Status badge, Payment Status badge, and interactive action buttons. Filterable by status pills (`All`, `Pending`, `Approved`, `Completed`, `Unpaid`, `Paid`).
- **Active Navigation Links**: Connected sidebar links (`Dashboard`, `Browse Equipment`, `My Bookings`, `Payments & Receipts`).

#### Added — Owner Workflow Enhancements
- **Dual-Badge Booking Cards**: Updated owner booking request cards to display both the Booking Approval Status badge and the Payment Status badge.
- **Direct Receipt Access**: Added a "View Demo Receipt" button for owner visibility on paid bookings.

#### Added — Database Migration & Tooling
- **`supabase/migrations/001_admin_and_security.sql`**: Safe, idempotent, non-destructive migration script covering:
  - `public.admins` table with Row Level Security.
  - `public.is_admin()` helper function.
  - Admin read-only policies on `profiles`, `equipment`, `booking_requests`, and `platform_settings`.
  - `platform_settings` table with 10% default commission seed.
  - `admin_overview()` aggregation function with null-safe joins.
  - Non-destructive `payment_status`, `payment_method`, `payment_ref`, and `paid_at` columns on `booking_requests`.
  - Role guard trigger preventing unauthorized client-side privilege escalation.
  - Documented SQL rollback instructions.

#### Refactored & Hardened
- Removed sensitive console logging of session tokens and raw profiles.
- Added UX guards preventing non-admin navigation to `#page-admin`.
- Preserved 100% of the earthy green and gold visual styling and layout tokens.
