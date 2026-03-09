
-- Conversation messages table for Agent 3 chatbot
CREATE TABLE public.conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL CHECK (role IN ('assistant', 'user')),
  content text NOT NULL,
  step_number integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to conversation_messages"
  ON public.conversation_messages FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);

-- Add conversation_data JSONB to leads for structured profile from chatbot
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversation_data jsonb DEFAULT NULL;

-- Add conversation status tracking
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS conversation_status text DEFAULT 'not_started' CHECK (conversation_status IN ('not_started', 'in_progress', 'complete'));

-- Add persona match field
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS persona_match text DEFAULT NULL;

-- Enable realtime for conversation_messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_messages;
