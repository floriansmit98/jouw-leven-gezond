
-- Create search_logs table for tracking missed/weak searches
CREATE TABLE public.search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  matched boolean NOT NULL DEFAULT false,
  match_quality text DEFAULT 'none', -- 'exact', 'alias', 'weak', 'none'
  matched_food_id uuid REFERENCES public.foods(id) ON DELETE SET NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.search_logs ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert (even anonymous for logging purposes)
CREATE POLICY "Anyone can insert search logs"
  ON public.search_logs
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Only allow reading own logs (authenticated)
CREATE POLICY "Users can read own search logs"
  ON public.search_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
