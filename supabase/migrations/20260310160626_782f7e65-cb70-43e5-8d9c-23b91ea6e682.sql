
-- CRM Records table
CREATE TABLE public.crm_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL UNIQUE,
  customer_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  phone_number TEXT,
  mailing_address TEXT,
  lead_source TEXT,
  lead_stage TEXT NOT NULL DEFAULT 'Inquiry',
  response_time_hours NUMERIC,
  initial_contact_date TIMESTAMPTZ,
  quote_issued_date TIMESTAMPTZ,
  quote_value NUMERIC,
  product_ordered TEXT,
  sales_rep TEXT,
  marketing_campaign_id TEXT,
  keyword_source TEXT,
  preferred_contact_method TEXT DEFAULT 'Email',
  customer_segment TEXT DEFAULT 'New Lead',
  marketing_opt_in_status BOOLEAN DEFAULT true,
  engagement_score INTEGER DEFAULT 0,
  referral_source TEXT,
  notes TEXT,
  qualification_score INTEGER,
  score_breakdown JSONB,
  routing_decision TEXT,
  persona_match TEXT,
  weak_categories JSONB DEFAULT '[]'::jsonb,
  assigned_actions JSONB DEFAULT '[]'::jsonb,
  follow_up_sequence TEXT,
  last_interaction_date TIMESTAMPTZ DEFAULT now(),
  sales_briefing TEXT,
  is_won BOOLEAN,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-up sequences table
CREATE TABLE public.follow_up_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  crm_record_id UUID REFERENCES public.crm_records(id) ON DELETE CASCADE,
  sequence_type TEXT NOT NULL, -- A, B, C, D
  status TEXT NOT NULL DEFAULT 'active', -- active, paused, completed, cancelled
  current_message_number INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 4,
  edit_before_sending BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Follow-up messages table
CREATE TABLE public.follow_up_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID REFERENCES public.follow_up_sequences(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  message_number INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  personalization_tags JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, queued, sent, responded, skipped
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.crm_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies (public access like other tables in this project)
CREATE POLICY "Allow all access to crm_records" ON public.crm_records FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to follow_up_sequences" ON public.follow_up_sequences FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to follow_up_messages" ON public.follow_up_messages FOR ALL TO public USING (true) WITH CHECK (true);

-- Enable realtime for follow_up_messages (for response flagging)
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.follow_up_sequences;
