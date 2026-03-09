
-- Add qualification fields to leads table
CREATE TYPE public.fit_level AS ENUM ('high_fit', 'medium_fit', 'low_fit');

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS qualification_score integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS qualification_data jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS fit_level public.fit_level DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS qualified_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS routing_action text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS routing_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS routed_at timestamp with time zone DEFAULT NULL;
