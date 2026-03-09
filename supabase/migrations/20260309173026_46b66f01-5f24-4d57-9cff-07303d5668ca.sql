
-- Lead status enum
CREATE TYPE public.lead_status AS ENUM ('complete', 'incomplete');

-- Budget range enum
CREATE TYPE public.budget_range AS ENUM ('under_30k', '30k_50k', '50k_80k', '80k_plus');

-- Timeline enum
CREATE TYPE public.lead_timeline AS ENUM ('asap', 'within_3_months', '3_6_months', '6_12_months', '12_plus_months');

-- Source enum
CREATE TYPE public.lead_source AS ENUM ('google', 'social_media', 'word_of_mouth', 'other');

-- Leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  location TEXT,
  budget budget_range,
  timeline lead_timeline,
  source lead_source,
  message TEXT NOT NULL,
  inquiry_summary TEXT,
  missing_fields JSONB DEFAULT '[]'::jsonb,
  lead_status lead_status NOT NULL DEFAULT 'incomplete',
  sent_to_conversation_agent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Permissive policy (single-user setup, matching existing pattern)
CREATE POLICY "Allow all access to leads" ON public.leads FOR ALL TO public USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
