-- Create evolution_instances table
CREATE TABLE IF NOT EXISTS public.evolution_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    instance_name TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'init',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT evolution_instances_user_id_key UNIQUE (user_id)
);

-- Add RLS Policies
ALTER TABLE public.evolution_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instance" 
    ON public.evolution_instances 
    FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own instance" 
    ON public.evolution_instances 
    FOR UPDATE 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own instance" 
    ON public.evolution_instances 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_evolution_instances_updated
    BEFORE UPDATE ON public.evolution_instances
    FOR EACH ROW
    EXECUTE PROCEDURE public.handle_updated_at();
