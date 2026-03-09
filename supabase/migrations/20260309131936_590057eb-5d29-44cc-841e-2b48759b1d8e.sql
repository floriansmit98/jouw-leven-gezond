
-- Add simplified_name column for better search matching
ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS simplified_name text;

-- Create index for faster text search
CREATE INDEX IF NOT EXISTS idx_foods_simplified_name ON public.foods(simplified_name);
