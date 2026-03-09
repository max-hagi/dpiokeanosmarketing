-- Create enum for content types
CREATE TYPE public.content_type AS ENUM ('social_post', 'blog_article', 'ad_copy', 'caption', 'image');

-- Create enum for content status
CREATE TYPE public.content_status AS ENUM ('draft', 'generating', 'review', 'approved', 'posted', 'rejected');

-- Create enum for platform
CREATE TYPE public.platform_type AS ENUM ('linkedin', 'instagram', 'x', 'facebook', 'website', 'other');

-- Create content_requests table
CREATE TABLE public.content_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prompt TEXT NOT NULL,
  content_type content_type NOT NULL DEFAULT 'social_post',
  target_audience TEXT,
  additional_context TEXT,
  status content_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create generated_content table
CREATE TABLE public.generated_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.content_requests(id) ON DELETE CASCADE,
  text_content TEXT,
  image_url TEXT,
  content_type content_type NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  target_platform platform_type,
  posted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create audit_log table for full history
CREATE TABLE public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID REFERENCES public.content_requests(id) ON DELETE SET NULL,
  content_id UUID REFERENCES public.generated_content(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Allow all access (single-user agent, no auth)
CREATE POLICY "Allow all access to content_requests" ON public.content_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to generated_content" ON public.generated_content FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- Create storage bucket for generated content
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-content', 'generated-content', true);
CREATE POLICY "Public read access for generated content" ON storage.objects FOR SELECT USING (bucket_id = 'generated-content');
CREATE POLICY "Allow uploads to generated content" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'generated-content');

-- Update timestamp function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_content_requests_updated_at BEFORE UPDATE ON public.content_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_generated_content_updated_at BEFORE UPDATE ON public.generated_content FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();