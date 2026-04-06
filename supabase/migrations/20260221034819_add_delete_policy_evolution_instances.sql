-- Add DELETE policy to evolution_instances table
CREATE POLICY "Users can delete their own instance" 
    ON public.evolution_instances 
    FOR DELETE 
    USING (auth.uid() = user_id);
