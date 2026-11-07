-- FarmRent migration 002: server-side email de-duplication ledger.
-- Written only by the send-farmrent-email Edge Function (service role).
-- RLS is enabled with NO policies, so browsers (anon/authenticated) cannot read or write it.

CREATE TABLE IF NOT EXISTS public.email_notifications (
  booking_id  uuid        NOT NULL REFERENCES public.booking_requests(id) ON DELETE CASCADE,
  event       text        NOT NULL CHECK (event IN ('payment_success', 'booking_confirmed')),
  status      text        NOT NULL DEFAULT 'sending' CHECK (status IN ('sending', 'sent', 'failed')),
  attempts    integer     NOT NULL DEFAULT 1,
  resend_id   text,
  last_error  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, event)
);

ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.email_notifications FROM anon, authenticated;