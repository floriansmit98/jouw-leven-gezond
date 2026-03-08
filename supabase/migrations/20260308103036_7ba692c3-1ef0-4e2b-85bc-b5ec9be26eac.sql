
-- Add display_name column
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS display_name text;
