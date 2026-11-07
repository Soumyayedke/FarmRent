# FarmRent — Manual Test Checklist

This checklist provides step-by-step test instructions for validating all features of the FarmRent portal during evaluation and presentations.

---

### Pre-Requisites
1. Start the local web server:
   ```bash
   python -m http.server 8000
   ```
2. Open your browser and navigate to: `http://localhost:8000`.

---

### Test Case 1: Farmer Account Registration & Login
- [ ] **Step 1.1**: Click the **"Login"** button in the top navigation bar.
- [ ] **Step 1.2**: In the modal, click **"Create Account"**.
- [ ] **Step 1.3**: Fill in the form:
  - Full Name: `Test Farmer`
  - Email: Enter a valid test email (e.g. `farmer.demo@example.com`)
  - Phone Number: `9876543210`
  - Address: `Village Post, District Pune, Maharashtra`
  - Password: `password123` (at least 6 characters)
  - Role: Select **"Rent Equipment"** (`farmer`)
- [ ] **Step 1.4**: Submit the form. Verify that the verification confirmation screen appears.
- [ ] **Step 1.5**: Log in with your farmer email and password.
- [ ] **Expected Result**: Welcome toast appears, navbar displays the farmer's name, and the user is routed to the **Farmer Dashboard** (`#page-dashboard`).

---

### Test Case 2: Equipment Browsing & Detailed Specifications
- [ ] **Step 2.1**: Click **"Browse Equipment"** in the top navigation bar or sidebar.
- [ ] **Step 2.2**: Verify that equipment listings load from Supabase (e.g. *John Deere 5310 Tractor*, *Combine Harvester*, *Rotavator*).
- [ ] **Step 2.3**: Test the category filter pills (e.g. click **"Tractor"**, then **"Harvester"**). Verify the list updates dynamically.
- [ ] **Step 2.4**: Click **"View Details"** on any equipment card.
- [ ] **Expected Result**: Detailed view loads with full equipment photos, specifications table (Fuel, HP, Cutting width, etc.), daily rental rate, and owner location.

---

### Test Case 3: Equipment Booking Request Submission
- [ ] **Step 3.1**: On the equipment details page, click **"Book This Equipment"**.
- [ ] **Step 3.2**: On the booking confirmation screen (`#page-booking`):
  - Pick a **Start Date** (e.g. Nov 10, 2026).
  - Pick an **End Date** (e.g. Nov 13, 2026).
- [ ] **Step 3.3**: Verify that:
  - Duration is calculated correctly (`3 Days`).
  - Rental Subtotal equals `Daily Rate × 3`.
  - Flat Service Fee is displayed (`₹500`).
  - Total Amount is the sum of Subtotal + Service Fee.
- [ ] **Step 3.4**: Click **"Confirm Booking"**.
- [ ] **Expected Result**:
  - Booking is saved to Supabase `booking_requests` with status `pending`.
  - Booking success screen is shown with unique reference (`FR-2026-XXXXX`).
  - A prominent Demo Payment prompt banner is displayed with **"Pay Now (Demo Simulation)"** and **"View in Farmer Dashboard"** buttons.

---

### Test Case 4: Owner Login & Booking Approval / Rejection
- [ ] **Step 4.1**: Log in with an owner account (e.g., an account registered with role `owner`).
- [ ] **Step 4.2**: Verify navigation redirects to **Owner Dashboard** (`#page-ownerDashboard`).
- [ ] **Step 4.3**: Click **"Booking Requests"** in the sidebar.
- [ ] **Step 4.4**: Verify that incoming booking requests appear with:
  - Equipment name, farmer dates, and total amount.
  - **Booking Status Badge** (e.g., `Pending`).
  - **Payment Status Badge** (e.g., `Unpaid` or `Paid (Demo)`).
- [ ] **Step 4.5**: On a pending request, click **"Accept"**.
  - Verify status changes to `Approved`.
  - Verify action button updates to **"Mark Completed"**.
- [ ] **Step 4.6**: On an approved request, click **"Mark Completed"**.
  - Verify status changes to `Completed`.
  - Verify the Total Earnings card in Owner Dashboard recalculates using `(total_amount - ₹500)`.
- [ ] **Expected Result**: Owner can accept, decline, or complete bookings. The payment status remains completely separate and untouched.

---

### Test Case 5: Demo Payment Simulation — Payment Success Outcome
- [ ] **Step 5.1**: From the booking confirmation screen or the Farmer Dashboard, click **"Pay Now (Demo Simulation)"**.
- [ ] **Step 5.2**: In the **Demo Payment Checkout Modal**:
  - Verify the **DEMO PAYMENT — NO REAL MONEY** warning banner is clearly visible.
  - Verify the itemized checkout breakdown: Equipment name, dates, duration, subtotal, ₹500 service fee, and total payable.
  - Verify payment method options (Demo UPI, Demo Card / NetBanking, Demo Pay on Delivery).
- [ ] **Step 5.3**: Select **"Demo UPI / QR"**.
- [ ] **Step 5.4**: Click the green button: **"Simulate Payment Success"**.
- [ ] **Step 5.5**: Observe the simulated authorization spinner (`"Simulating payment gateway authorization..."`).
- [ ] **Step 5.6**: Observe the transition:
  - Checkout modal closes with a success toast.
  - The official **Demo Receipt Modal** automatically opens.
- [ ] **Step 5.7**: In the Demo Receipt:
  - Verify Receipt Number (`FR-REC-2026-XXXXX`).
  - Verify Transaction ID (`TXN-DEMO-SIM-XXXXXX`).
  - Verify timestamp, farmer name, equipment rental fee, and platform service fee.
  - Verify the green watermark stamp: **PAID — DEMO SIMULATION**.
  - Click **"Print Receipt"** to verify browser print dialog launches.
- [ ] **Expected Result**: Demo payment successfully sets payment status to `paid`, updates the farmer dashboard total spent, and generates an official printable demo receipt.

---

### Test Case 6: Demo Payment Simulation — Payment Failure Outcome
- [ ] **Step 6.1**: Open the Demo Payment Checkout Modal for any unpaid booking.
- [ ] **Step 6.2**: Click the red outline button: **"Simulate Payment Failure"**.
- [ ] **Step 6.3**: Observe the processing spinner followed by the red failure alert banner:
  - *"Simulated Payment Failed: Simulated gateway decline: Bank server timeout or insufficient simulated credit balance. No money was touched."*
- [ ] **Step 6.4**: Verify that action buttons re-enable, allowing the user to switch payment methods or retry simulation.
- [ ] **Step 6.5**: Click **"Cancel / Pay Later"** to dismiss the modal.
- [ ] **Step 6.6**: Check the Farmer Dashboard.
- [ ] **Expected Result**: Payment status displays **"Failed"** or **"Unpaid"** badge with an active **"Pay Now (Demo)"** button, allowing retries.

---

### Test Case 7: Admin Provisioning & Admin Analytics Dashboard
- [ ] **Step 7.1**: Grant admin access to your test account using Supabase SQL Editor:
  ```sql
  INSERT INTO public.admins (user_id)
  SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com'
  ON CONFLICT (user_id) DO NOTHING;
  
  UPDATE public.profiles SET role = 'admin' WHERE email = 'YOUR_EMAIL@example.com';
  ```
- [ ] **Step 7.2**: Log in with this admin account.
- [ ] **Step 7.3**: Verify navigation automatically redirects to the **Admin Dashboard** (`#page-admin`).
- [ ] **Step 7.4**: Check the **Overview** tab:
  - **Recorded Data**: Registered Farmers, Registered Owners, Equipment Listings, Booking Requests.
  - **Transaction Value Cards**:
    - *Completed Bookings Value [Recorded]*
    - *Platform Commission [Estimate]* (calculated at 10% default)
    - *Owner Earnings [Estimate]* (completed value minus platform commission)
    - *Demo Paid Volume [Simulated]* (volume settled via demo payments)
  - **Visual Bars**:
    - Booking Status Breakdown progress bars.
    - Monthly Booking Trend bars with booking count and completed value.
    - Bookings by Equipment Category popularity bars.
- [ ] **Step 7.5**: Click the **"Users"** tab in the sidebar. Verify the read-only user table lists all registered accounts with full names, emails, phones, and roles.
- [ ] **Step 7.6**: Click the **"Equipment"** tab in the sidebar. Verify the read-only equipment table lists machinery with categories, owner names, rates, and availability.
- [ ] **Step 7.7**: Click the **"Commission"** tab in the sidebar.
  - Change the commission rate from `10` to `15`.
  - Click **"Save"**.
  - Return to the **Overview** tab and verify that platform commission and owner earnings estimates immediately recalculate to reflect 15%.
- [ ] **Expected Result**: Admin dashboard displays real database metrics, accurate status/monthly/category visual bars, management tables, and dynamic commission recalculation.

---

### Test Case 8: Independent State Separation Verification
- [ ] **Step 8.1**: Submit a new booking as a farmer. (Initial state: Booking = `Pending`, Payment = `Unpaid`).
- [ ] **Step 8.2**: Log in as the owner of that equipment. Click **"Accept"**, then click **"Mark Completed"**.
- [ ] **Step 8.3**: Check the booking card on the Owner Dashboard:
  - Booking Status is `Completed`.
  - Payment Status is STILL `Unpaid`.
- [ ] **Step 8.4**: Log in as the farmer. On Farmer Dashboard, verify the booking shows `Completed` with `Unpaid`.
- [ ] **Step 8.5**: Click **"Pay Now (Demo)"** and simulate payment success.
- [ ] **Step 8.6**: Refresh and verify:
  - Booking Status is `Completed`.
  - Payment Status is `Paid (Demo)`.
- [ ] **Expected Result**: Confirms that marking a rental completed does not automatically imply payment receipt, satisfying core financial audit integrity requirements.
