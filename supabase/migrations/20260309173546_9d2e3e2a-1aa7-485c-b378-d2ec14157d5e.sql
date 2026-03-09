
-- Lead stage enum for pipeline tracking
CREATE TYPE public.lead_stage AS ENUM ('inquiry', 'qualified', 'quoted', 'sold', 'installed', 'retention');

-- Customer segment enum
CREATE TYPE public.customer_segment AS ENUM ('new_lead', 'high_value', 'warm', 'dormant');

-- Preferred contact method enum
CREATE TYPE public.preferred_contact AS ENUM ('email', 'phone', 'sms', 'any');

-- Add new columns to leads table
ALTER TABLE public.leads
  ADD COLUMN mailing_address TEXT,
  ADD COLUMN preferred_contact preferred_contact DEFAULT 'any',
  ADD COLUMN referral_source TEXT,
  ADD COLUMN campaign_id TEXT,
  ADD COLUMN keyword_source TEXT,
  ADD COLUMN lead_stage lead_stage NOT NULL DEFAULT 'inquiry',
  ADD COLUMN customer_segment customer_segment DEFAULT 'new_lead',
  ADD COLUMN engagement_score INTEGER DEFAULT 0,
  ADD COLUMN response_time_hours NUMERIC;
