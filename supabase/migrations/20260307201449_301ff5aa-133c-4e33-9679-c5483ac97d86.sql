ALTER TABLE public.foods ADD COLUMN IF NOT EXISTS aliases text[] DEFAULT '{}';

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_foods_name_trgm ON public.foods USING gin (name gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_foods(search_query text, page_size int DEFAULT 20, page_offset int DEFAULT 0)
RETURNS SETOF public.foods
LANGUAGE sql
STABLE
SECURITY INVOKER
AS $$
  SELECT DISTINCT f.*
  FROM public.foods f
  WHERE (
    search_query = '' OR
    NOT EXISTS (
      SELECT 1 FROM unnest(string_to_array(trim(search_query), ' ')) AS word
      WHERE word != ''
        AND NOT (
          f.name ILIKE '%' || word || '%'
          OR EXISTS (
            SELECT 1 FROM unnest(f.aliases) AS alias
            WHERE alias ILIKE '%' || word || '%'
          )
        )
    )
  )
  ORDER BY f.name
  LIMIT page_size
  OFFSET page_offset;
$$;