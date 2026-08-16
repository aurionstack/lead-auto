-- Add search_configs table for autonomous scraping
CREATE TABLE IF NOT EXISTS public.search_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_query TEXT NOT NULL,
    location TEXT NOT NULL,
    channel TEXT NOT NULL DEFAULT 'email',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_scraped_at TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Setup RLS
ALTER TABLE public.search_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all read access for search_configs"
    ON public.search_configs FOR SELECT
    USING (true);

CREATE POLICY "Allow all insert access for search_configs"
    ON public.search_configs FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow all update access for search_configs"
    ON public.search_configs FOR UPDATE
    USING (true);

CREATE POLICY "Allow all delete access for search_configs"
    ON public.search_configs FOR DELETE
    USING (true);

-- Seed with baseline targets
INSERT INTO public.search_configs (search_query, location, channel)
VALUES 
    ('Luxury car rental', 'Goa, India', 'whatsapp'),
    ('Boutique resort', 'Goa, India', 'whatsapp'),
    ('Yacht charter', 'Dubai, UAE', 'whatsapp'),
    ('Real estate developer', 'Miami, Florida', 'email'),
    ('Logistics company', 'Texas, USA', 'email'),
    ('Marketing agency', 'London, UK', 'email')
ON CONFLICT DO NOTHING;
