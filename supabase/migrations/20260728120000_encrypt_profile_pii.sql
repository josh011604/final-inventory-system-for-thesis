-- Adds ciphertext columns for profiles.employee_id / profiles.phone. The
-- encryption key (PROFILE_PII_KEY) lives only in the profile-pii Edge
-- Function's secrets, never in Postgres, so these columns stay opaque even
-- to a full database dump or a superuser session. See
-- supabase/functions/_shared/pii-crypto.ts for the AES-256-GCM implementation.
--
-- The plaintext employee_id/phone columns are left in place for this phase —
-- see scripts/backfill-profile-pii.mjs to populate the new columns for
-- existing rows. Dropping the plaintext columns is a deliberate follow-up
-- migration once the encrypted path is confirmed working end to end.
alter table public.profiles
  add column if not exists employee_id_enc text,
  add column if not exists phone_enc text;

comment on column public.profiles.employee_id_enc is
  'AES-256-GCM ciphertext (base64: iv || ciphertext+tag). Encrypt/decrypt only via the profile-pii Edge Function.';
comment on column public.profiles.phone_enc is
  'AES-256-GCM ciphertext (base64: iv || ciphertext+tag). Encrypt/decrypt only via the profile-pii Edge Function.';
