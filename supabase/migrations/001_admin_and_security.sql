-- =====================================================================
-- FarmRent — SQL Migration 001 (Final Verified & Hardened)
-- Description: Controlled Admin Access, Safe Demo Payments, and Protected Owner Workflows
-- Safe, Idempotent, and Non-Destructive for Existing Supabase Schemas
-- Schema Alignments:
--   - equipment.id is bigint
--   - booking_requests.id is uuid
--   - profiles.id is uuid
-- =====================================================================

-- =====================================================================
-- SECTION 1: EXPLICIT ADMINISTRATOR PROVISIONING TABLE
-- Admin privileges are strictly assigned through this table by a database
-- administrator. Public signup or client APIs CANNOT insert/update/delete here.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security so no unauthorized access occurs
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to verify if their OWN user_id is in the admin table.
-- There are NO insert, update, or delete policies for authenticated or anon users.
DROP POLICY IF EXISTS "admins: read own row" ON public.admins;
CREATE POLICY "admins: read own row" ON public.admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());


-- =====================================================================
-- SECTION 2: SECURE is_admin() FUNCTION
-- Evaluates whether the currently authenticated session belongs to an
-- explicitly provisioned administrator in public.admins.
-- CRITICAL SECURITY RULE: Does NOT trust public.profiles.role or user_metadata.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- =====================================================================
-- SECTION 3: SIGNUP SANITIZATION & PROFILE ROLE SECURITY GUARD
-- 1. Modifies public.handle_new_user() so public signup can ONLY create
--    'farmer' or 'owner' profiles. Any metadata requesting 'admin' is coerced to 'farmer'.
-- 2. Attaches guard_profile_role() to prevent client APIs (even authenticated admins)
--    from casually changing roles through normal profile updates.
-- =====================================================================

-- 3A: Sanitize auth signup at the entry point
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role text;
BEGIN
  -- Extract and sanitize the role from raw_user_meta_data.
  -- STRICT SECURITY CONSTRAINT: Public signup can ONLY create 'farmer' or 'owner' profiles.
  -- Any attempt to request 'admin' (or any other unrecognized role) is sanitized to 'farmer'.
  v_role := lower(trim(COALESCE(new.raw_user_meta_data->>'role', 'farmer')));
  IF v_role NOT IN ('farmer', 'owner') THEN
    v_role := 'farmer';
  END IF;

  INSERT INTO public.profiles (id, full_name, email, phone, address, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    COALESCE(new.raw_user_meta_data->>'address', ''),
    v_role
  )
  ON CONFLICT (id) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    address = EXCLUDED.address;
    -- Note: role is intentionally preserved and cannot be overwritten on conflict!

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 3B: Defense-in-depth trigger on public.profiles
CREATE OR REPLACE FUNCTION public.guard_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- On INSERT:
  -- A profile cannot have role = 'admin' unless that user_id is ALREADY explicitly
  -- provisioned in public.admins. If not, coerce to 'farmer'.
  IF new.role = 'admin' THEN
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = new.id) THEN
      new.role := 'farmer';
    END IF;
  END IF;

  -- Ensure role value is valid (default to 'farmer' if null or invalid)
  IF new.role NOT IN ('farmer', 'owner', 'admin') OR new.role IS NULL THEN
    new.role := 'farmer';
  END IF;

  -- On UPDATE:
  -- Prevent privilege escalation:
  -- An authenticated client session (auth.uid() IS NOT NULL) can NEVER modify 'role', 'id', or 'email'.
  -- Even an authenticated administrator cannot change user roles via standard client API calls.
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL THEN
    IF new.role IS DISTINCT FROM old.role THEN
      RAISE EXCEPTION 'Profile role cannot be modified via client API updates. Admin provisioning must be performed through the deliberate database administration process.';
    END IF;
    IF new.id IS DISTINCT FROM old.id OR new.email IS DISTINCT FROM old.email THEN
      RAISE EXCEPTION 'Profile id and email cannot be modified via client API updates.';
    END IF;
  END IF;

  -- For direct DBA updates (auth.uid() IS NULL):
  -- If setting role = 'admin', require that the user is already provisioned in public.admins.
  IF TG_OP = 'UPDATE' AND new.role = 'admin' AND old.role <> 'admin' THEN
    IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = new.id) THEN
      RAISE EXCEPTION 'User must be added to public.admins before setting role = admin in profiles.';
    END IF;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
CREATE TRIGGER trg_guard_profile_role
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_role();


-- =====================================================================
-- SECTION 4: ADDITIVE ADMIN READ POLICIES
-- Allows provisioned administrators to read system data for analytics.
-- Existing farmer and owner policies are preserved and untouched.
-- =====================================================================

DROP POLICY IF EXISTS "admin read profiles" ON public.profiles;
CREATE POLICY "admin read profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin read equipment" ON public.equipment;
CREATE POLICY "admin read equipment" ON public.equipment
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin read bookings" ON public.booking_requests;
CREATE POLICY "admin read bookings" ON public.booking_requests
  FOR SELECT TO authenticated USING (public.is_admin());


-- =====================================================================
-- SECTION 5: PLATFORM SETTINGS (COMMISSION CONFIGURATION)
-- Admin-only table for illustrative platform commission estimation (default 10%).
-- Non-admins cannot read or modify these settings.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  commission_percent numeric(5,2) NOT NULL DEFAULT 10.00 CHECK (commission_percent BETWEEN 0 AND 30)
);

INSERT INTO public.platform_settings (id, commission_percent)
VALUES (true, 10.00)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin read settings" ON public.platform_settings;
CREATE POLICY "admin read settings" ON public.platform_settings
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "admin update settings" ON public.platform_settings;
CREATE POLICY "admin update settings" ON public.platform_settings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- =====================================================================
-- SECTION 6: DEMO PAYMENT AUDIT COLUMNS
-- Adds non-destructive payment tracking columns on booking_requests.
-- State separation: booking status is decoupled from payment status.
-- =====================================================================

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_status text DEFAULT 'unpaid';

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_method text;

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS payment_ref text;

ALTER TABLE public.booking_requests
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_requests_payment_status_check'
  ) THEN
    ALTER TABLE public.booking_requests
      ADD CONSTRAINT booking_requests_payment_status_check
      CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed', 'refunded'));
  END IF;
END $$;

-- SECURITY CRITICAL: Drop any open update policy that would allow farmers
-- to modify arbitrary columns (such as price, dates, or booking approval status).
DROP POLICY IF EXISTS "farmer update booking payment" ON public.booking_requests;


-- =====================================================================
-
-- =====================================================================
-- SECTION 7: OWNER UPDATE POLICY & BOOKING INTEGRITY GUARD
-- =====================================================================

DROP POLICY IF EXISTS "Owners can update booking requests"
  ON public.booking_requests;

DROP POLICY IF EXISTS "Owners can update their booking requests"
  ON public.booking_requests;

DROP POLICY IF EXISTS "owner update booking status"
  ON public.booking_requests;

DROP POLICY IF EXISTS "owner update booking"
  ON public.booking_requests;

DROP POLICY IF EXISTS "owners can update their own bookings"
  ON public.booking_requests;

CREATE POLICY "Owners can update their booking requests"
ON public.booking_requests
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());


CREATE OR REPLACE FUNCTION public.guard_booking_requests_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Direct database administration
  IF auth.uid() IS NULL THEN
    RETURN new;
  END IF;

  -- Admin updates: booking identity cannot be changed
  IF public.is_admin() THEN
    IF new.id IS DISTINCT FROM old.id
       OR new.farmer_id IS DISTINCT FROM old.farmer_id
       OR new.owner_id IS DISTINCT FROM old.owner_id THEN
      RAISE EXCEPTION 'Booking identity cannot be changed';
    END IF;
    RETURN new;
  END IF;

  -- Owner updates: only booking status is permitted
  IF old.owner_id = auth.uid() THEN

    IF new.id IS DISTINCT FROM old.id
       OR new.farmer_id IS DISTINCT FROM old.farmer_id
       OR new.owner_id IS DISTINCT FROM old.owner_id
       OR new.equipment_name IS DISTINCT FROM old.equipment_name
       OR new.equipment_image IS DISTINCT FROM old.equipment_image
       OR new.start_date IS DISTINCT FROM old.start_date
       OR new.end_date IS DISTINCT FROM old.end_date
       OR new.total_amount IS DISTINCT FROM old.total_amount
       OR new.payment_status IS DISTINCT FROM old.payment_status
       OR new.payment_method IS DISTINCT FROM old.payment_method
       OR new.payment_ref IS DISTINCT FROM old.payment_ref
       OR new.paid_at IS DISTINCT FROM old.paid_at
       OR new.created_at IS DISTINCT FROM old.created_at THEN
      RAISE EXCEPTION 'Owners can only update booking status';
    END IF;

    IF new.status IS DISTINCT FROM old.status THEN
      IF NOT (
        (old.status = 'pending' AND new.status IN ('approved', 'rejected'))
        OR
        (old.status = 'approved' AND new.status = 'completed')
      ) THEN
        RAISE EXCEPTION 'Invalid booking status transition';
      END IF;
    END IF;

    RETURN new;
  END IF;

  -- Farmer payment updates: payment fields only
  IF old.farmer_id = auth.uid() THEN

    IF new.id IS DISTINCT FROM old.id
       OR new.farmer_id IS DISTINCT FROM old.farmer_id
       OR new.owner_id IS DISTINCT FROM old.owner_id
       OR new.equipment_name IS DISTINCT FROM old.equipment_name
       OR new.equipment_image IS DISTINCT FROM old.equipment_image
       OR new.start_date IS DISTINCT FROM old.start_date
       OR new.end_date IS DISTINCT FROM old.end_date
       OR new.total_amount IS DISTINCT FROM old.total_amount
       OR new.status IS DISTINCT FROM old.status
       OR new.created_at IS DISTINCT FROM old.created_at THEN
      RAISE EXCEPTION 'Payment process cannot alter booking details';
    END IF;

    IF new.payment_status NOT IN ('paid', 'failed')
       OR old.payment_status = 'paid' THEN
      RAISE EXCEPTION 'Invalid payment status transition';
    END IF;

    RETURN new;
  END IF;

  RAISE EXCEPTION 'Unauthorized booking update';
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_booking_requests_update
ON public.booking_requests;

CREATE TRIGGER trg_guard_booking_requests_update
BEFORE UPDATE ON public.booking_requests
FOR EACH ROW
EXECUTE FUNCTION public.guard_booking_requests_update();


-- =====================================================================
-- SECTION 8: SECURE SERVER-SIDE DEMO PAYMENT FUNCTION (RPC)
-- Restricts payment status updates to this safe database function.
-- Validates caller ownership, leaves core booking details immutable,
-- and clearly flags the transaction as an academic demonstration.
-- SCHEMA ALIGNMENT: p_booking_id is typed as uuid to match booking_requests.id
-- =====================================================================


CREATE OR REPLACE FUNCTION public.record_demo_payment(
  p_booking_id uuid,
  p_payment_method text DEFAULT 'demo_upi',
  p_simulate_success boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_farmer_id uuid;
  v_total_amount numeric;
  v_equipment_name text;
  v_status text;
  v_payment_status text;
  v_txn_ref text;
  v_rcpt_id text;
  v_paid_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT farmer_id, total_amount, equipment_name,
         status, payment_status
  INTO v_farmer_id, v_total_amount, v_equipment_name,
       v_status, v_payment_status
  FROM public.booking_requests
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found';
  END IF;

  IF v_farmer_id <> auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized payment request';
  END IF;

  IF v_status = 'rejected' THEN
    RAISE EXCEPTION 'Cannot pay for a rejected booking';
  END IF;

  IF v_payment_status = 'paid' THEN
    RAISE EXCEPTION 'This booking has already been paid';
  END IF;

  v_txn_ref := 'TXN-DEMO-SIM-' ||
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  v_rcpt_id := 'FR-REC-' ||
    to_char(now(), 'YYYY') || '-' ||
    lpad((floor(random() * 90000) + 10000)::text, 5, '0');

  v_paid_at := now();

  IF p_simulate_success THEN
    UPDATE public.booking_requests
    SET payment_status = 'paid',
        payment_method = coalesce(p_payment_method, 'demo_upi'),
        payment_ref = v_txn_ref,
        paid_at = v_paid_at
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'is_demo', true,
      'booking_id', p_booking_id,
      'equipment_name', v_equipment_name,
      'total_amount', v_total_amount,
      'payment_status', 'paid',
      'payment_method', coalesce(p_payment_method, 'demo_upi'),
      'transaction_ref', v_txn_ref,
      'receipt_id', v_rcpt_id,
      'paid_at', v_paid_at,
      'notice', 'DEMO PAYMENT SIMULATION — NO REAL MONEY WAS CHARGED'
    );
  ELSE
    UPDATE public.booking_requests
    SET payment_status = 'failed',
        payment_method = coalesce(p_payment_method, 'demo_upi'),
        payment_ref = v_txn_ref
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', false,
      'is_demo', true,
      'booking_id', p_booking_id,
      'payment_status', 'failed',
      'transaction_ref', v_txn_ref,
      'notice', 'DEMO PAYMENT SIMULATION — NO REAL MONEY WAS CHARGED'
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_demo_payment(uuid, text, boolean)
FROM public, anon;

GRANT EXECUTE ON FUNCTION public.record_demo_payment(uuid, text, boolean)
TO authenticated;


-- =====================================================================
-- SECTION 9: ADMIN ANALYTICS AGGREGATION RPC FUNCTION
-- Aggregates real database metrics in a single secure, optimized call.
-- Compatible with schema: equipment.id (bigint) & booking_requests (equipment_name, id uuid).
-- Uses DISTINCT ON to prevent Cartesian inflation if equipment share names.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden: administrator privileges required';
  END IF;

  RETURN jsonb_build_object(
    'farmers',   (SELECT count(*) FROM public.profiles WHERE role = 'farmer'),
    'owners',    (SELECT count(*) FROM public.profiles WHERE role = 'owner'),
    'equipment', (SELECT count(*) FROM public.equipment),
    'bookings',  (SELECT count(*) FROM public.booking_requests),
    'by_status', COALESCE((
      SELECT jsonb_object_agg(s, n) FROM (
        SELECT COALESCE(status, 'unknown') AS s, count(*) AS n
        FROM public.booking_requests
        GROUP BY 1
      ) x
    ), '{}'::jsonb),
    'monthly', COALESCE((
      SELECT jsonb_agg(m ORDER BY m->>'month') FROM (
        SELECT jsonb_build_object(
          'month', to_char(date_trunc('month', created_at), 'YYYY-MM'),
          'bookings', count(*),
          'completed_value', COALESCE(sum(total_amount) FILTER (WHERE status = 'completed'), 0)
        ) AS m
        FROM public.booking_requests
        GROUP BY date_trunc('month', created_at)
      ) t
    ), '[]'::jsonb),
    'by_category', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', category, 'bookings', n)) FROM (
        SELECT COALESCE(e.category, 'Other / Unassigned') AS category, count(*) AS n
        FROM public.booking_requests b
        LEFT JOIN (
          SELECT DISTINCT ON (name) name, category
          FROM public.equipment
          ORDER BY name, id
        ) e ON e.name = b.equipment_name
        GROUP BY COALESCE(e.category, 'Other / Unassigned')
      ) c
    ), '[]'::jsonb),
    'completed_value', (SELECT COALESCE(sum(total_amount), 0) FROM public.booking_requests WHERE status = 'completed'),
    'paid_value', (SELECT COALESCE(sum(total_amount), 0) FROM public.booking_requests WHERE payment_status = 'paid')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_overview() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_overview() TO authenticated;


-- =====================================================================
-- SECTION 10: DELIBERATE ADMINISTRATOR PROVISIONING PROCEDURE
-- Execute in Supabase SQL Editor (direct DBA access). Replace with admin email.
-- =====================================================================

/*
-- Step A: Add your user's auth ID to the admins table
INSERT INTO public.admins (user_id)
SELECT id FROM auth.users WHERE email = 'YOUR_EMAIL@example.com'
ON CONFLICT (user_id) DO NOTHING;

-- Step B: Update the profile role to 'admin' for UI display
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'YOUR_EMAIL@example.com';
*/


-- =====================================================================
-- SECTION 11: NON-DESTRUCTIVE VERIFICATION QUERIES
-- Run these after the migration to verify all components.
-- =====================================================================

/*
-- 1. Verify admins table exists and has RLS enabled
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('admins', 'platform_settings');

-- 2. Verify platform_settings table and seed row
SELECT * FROM public.platform_settings;

-- 3. Verify columns added to booking_requests
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'booking_requests'
  AND column_name IN ('payment_status', 'payment_method', 'payment_ref', 'paid_at');

-- 4. Verify owner update policy exists and farmer update policy is dropped
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'booking_requests';

-- 5. Test is_admin() function
SELECT public.is_admin();

-- 6. Verify functions and triggers exist with correct security settings
SELECT proname, prosecdef
FROM pg_proc
WHERE proname IN ('is_admin', 'record_demo_payment', 'admin_overview', 'guard_profile_role', 'guard_booking_requests_update', 'handle_new_user');

SELECT tgname, relname
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
WHERE tgname IN ('trg_guard_profile_role', 'trg_guard_booking_requests_update', 'on_auth_user_created');
*/


-- =====================================================================
-- SECTION 12: AUDITED SAFE ROLLBACK SCRIPT & DEPENDENCY CHECKLIST
-- Safe, dependency-ordered undo commands if you ever need to revert this migration.
-- Preserves existing user accounts, equipment rows, booking records, and core signup logic.
-- =====================================================================

/*
-- DEPENDENCY CHECKLIST BEFORE ROLLBACK:
-- 1. Triggers on public.booking_requests and public.profiles depend on their respective guard functions.
--    Drop triggers FIRST before dropping functions.
-- 2. RLS policies ("admin read *", "admin update *") and RPC functions (admin_overview, record_demo_payment)
--    depend on public.is_admin().
--    Drop policies and RPC functions FIRST before attempting to drop public.is_admin().
-- 3. Pre-existing tables (profiles, equipment, booking_requests, auth.users) and pre-existing data
--    are NEVER dropped by this rollback.
-- 4. Pre-existing signup function: DO NOT drop public.handle_new_user()!
--    auth.users relies on handle_new_user() for account registrations.
-- 5. Owner policy note: The policy "Owners can update their booking requests" is preserved to ensure
--    owners retain their ability to approve/reject bookings.

-- Step 1: Drop booking request guard trigger and function
DROP TRIGGER IF EXISTS trg_guard_booking_requests_update ON public.booking_requests;
DROP FUNCTION IF EXISTS public.guard_booking_requests_update();

-- Step 2: Drop profile guard trigger and function
DROP TRIGGER IF EXISTS trg_guard_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.guard_profile_role();

-- Step 3: Drop RPC functions that depend on is_admin()
DROP FUNCTION IF EXISTS public.record_demo_payment(uuid, text, boolean);
DROP FUNCTION IF EXISTS public.admin_overview();

-- Step 4: Drop platform_settings policies and table
DROP POLICY IF EXISTS "admin update settings" ON public.platform_settings;
DROP POLICY IF EXISTS "admin read settings" ON public.platform_settings;
DROP TABLE IF EXISTS public.platform_settings;

-- Step 5: Drop additive admin read policies on core tables
DROP POLICY IF EXISTS "admin read bookings" ON public.booking_requests;
DROP POLICY IF EXISTS "admin read equipment" ON public.equipment;
DROP POLICY IF EXISTS "admin read profiles" ON public.profiles;

-- Step 6: Drop is_admin() function (now safe since all dependents are dropped)
DROP FUNCTION IF EXISTS public.is_admin();

-- Step 7: Drop admins table policy and table
DROP POLICY IF EXISTS "admins: read own row" ON public.admins;
DROP TABLE IF EXISTS public.admins;

-- Step 8: Ensure the owner update policy remains active with standard definition
DROP POLICY IF EXISTS "Owners can update their booking requests" ON public.booking_requests;
CREATE POLICY "Owners can update their booking requests" ON public.booking_requests
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- OPTIONAL CLEANUP:
-- The demo payment tracking columns on booking_requests are harmless nullable columns.
-- If you specifically wish to drop them, run:
-- ALTER TABLE public.booking_requests DROP CONSTRAINT IF EXISTS booking_requests_payment_status_check;
-- ALTER TABLE public.booking_requests
--   DROP COLUMN IF EXISTS payment_status,
--   DROP COLUMN IF EXISTS payment_method,
--   DROP COLUMN IF EXISTS payment_ref,
--   DROP COLUMN IF EXISTS paid_at;
*/
