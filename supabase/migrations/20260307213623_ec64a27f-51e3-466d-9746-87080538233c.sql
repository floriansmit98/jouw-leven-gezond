CREATE OR REPLACE FUNCTION public.search_foods_by_type(
  search_query text,
  is_drink boolean DEFAULT false,
  page_size integer DEFAULT 20,
  page_offset integer DEFAULT 0
)
RETURNS SETOF foods
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT DISTINCT f.*
  FROM public.foods f
  WHERE (
    CASE WHEN is_drink THEN
      f.category IN ('dranken', 'alcohol', 'soepen')
    ELSE
      f.category NOT IN ('dranken', 'alcohol', 'soepen')
    END
  )
  AND (
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