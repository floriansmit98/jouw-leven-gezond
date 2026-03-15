
CREATE TABLE public.barcode_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barcode text NOT NULL,
  food_id uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  product_name text,
  brand text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (barcode)
);

ALTER TABLE public.barcode_mappings ENABLE ROW LEVEL SECURITY;

-- Anyone can read mappings (shared knowledge)
CREATE POLICY "Anyone can read barcode mappings"
ON public.barcode_mappings FOR SELECT TO public
USING (true);

-- Authenticated users can insert mappings
CREATE POLICY "Authenticated users can insert barcode mappings"
ON public.barcode_mappings FOR INSERT TO authenticated
WITH CHECK (true);
