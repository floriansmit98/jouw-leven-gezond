
CREATE OR REPLACE FUNCTION public.search_foods_ranked(search_query text, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS SETOF foods
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH query_words AS (
    SELECT unnest(string_to_array(lower(trim(search_query)), ' ')) AS word
    WHERE trim(search_query) != ''
  ),
  scored AS (
    SELECT f.*,
      CASE
        WHEN lower(COALESCE(f.display_name, f.name)) = lower(trim(search_query)) THEN 100
        WHEN lower(f.name) = lower(trim(search_query)) THEN 100
        WHEN lower(COALESCE(f.brand, '')) = lower(trim(search_query)) THEN 95
        WHEN lower(COALESCE(f.display_name, f.name)) LIKE lower(trim(search_query)) || '%' THEN 80
        WHEN lower(f.name) LIKE lower(trim(search_query)) || '%' THEN 80
        WHEN lower(COALESCE(f.brand, '')) LIKE lower(trim(search_query)) || '%' THEN 75
        WHEN lower(COALESCE(f.display_name, f.name)) LIKE '%' || lower(trim(search_query)) || '%' THEN 60
        WHEN lower(f.name) LIKE '%' || lower(trim(search_query)) || '%' THEN 60
        WHEN lower(COALESCE(f.brand, '')) LIKE '%' || lower(trim(search_query)) || '%' THEN 55
        WHEN NOT EXISTS (
          SELECT 1 FROM query_words qw
          WHERE NOT (
            lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
            OR lower(f.name) LIKE '%' || qw.word || '%'
            OR lower(COALESCE(f.brand, '')) LIKE '%' || qw.word || '%'
          )
        ) THEN 50
        WHEN EXISTS (
          SELECT 1 FROM unnest(f.aliases) AS alias
          WHERE lower(alias) LIKE '%' || lower(trim(search_query)) || '%'
        ) THEN 40
        WHEN NOT EXISTS (
          SELECT 1 FROM query_words qw
          WHERE NOT (
            lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
            OR lower(f.name) LIKE '%' || qw.word || '%'
            OR lower(COALESCE(f.brand, '')) LIKE '%' || qw.word || '%'
            OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
          )
        ) THEN 35
        WHEN EXISTS (
          SELECT 1 FROM unnest(f.keywords) AS kw
          WHERE lower(kw) LIKE '%' || lower(trim(search_query)) || '%'
        ) THEN 30
        WHEN NOT EXISTS (
          SELECT 1 FROM query_words qw
          WHERE NOT (
            lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
            OR lower(f.name) LIKE '%' || qw.word || '%'
            OR lower(COALESCE(f.brand, '')) LIKE '%' || qw.word || '%'
            OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
            OR EXISTS (SELECT 1 FROM unnest(f.keywords) AS kw WHERE lower(kw) LIKE '%' || qw.word || '%')
          )
        ) THEN 25
        ELSE 0
      END AS rank_score
    FROM public.foods f
    WHERE trim(search_query) = '' OR (
      NOT EXISTS (
        SELECT 1 FROM query_words qw
        WHERE NOT (
          lower(COALESCE(f.display_name, f.name)) LIKE '%' || qw.word || '%'
          OR lower(f.name) LIKE '%' || qw.word || '%'
          OR lower(COALESCE(f.brand, '')) LIKE '%' || qw.word || '%'
          OR EXISTS (SELECT 1 FROM unnest(f.aliases) AS alias WHERE lower(alias) LIKE '%' || qw.word || '%')
          OR EXISTS (SELECT 1 FROM unnest(f.keywords) AS kw WHERE lower(kw) LIKE '%' || qw.word || '%')
        )
      )
    )
  )
  SELECT id, name, category, portion_description, portion_grams, potassium_mg, phosphate_mg,
         sodium_mg, protein_g, fluid_ml, dialysis_risk_label, created_at, aliases, keywords, display_name, brand
  FROM scored
  WHERE rank_score > 0 OR trim(search_query) = ''
  ORDER BY rank_score DESC, COALESCE(display_name, name) ASC
  LIMIT page_size
  OFFSET page_offset;
$function$;

CREATE OR REPLACE FUNCTION public.search_foods_by_type(search_query text, is_drink boolean DEFAULT false, page_size integer DEFAULT 20, page_offset integer DEFAULT 0)
 RETURNS SETOF foods
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT f.*
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
          COALESCE(f.display_name, f.name) ILIKE '%' || word || '%'
          OR f.name ILIKE '%' || word || '%'
          OR COALESCE(f.brand, '') ILIKE '%' || word || '%'
          OR EXISTS (
            SELECT 1 FROM unnest(f.aliases) AS alias
            WHERE alias ILIKE '%' || word || '%'
          )
          OR EXISTS (
            SELECT 1 FROM unnest(f.keywords) AS kw
            WHERE kw ILIKE '%' || word || '%'
          )
        )
    )
  )
  ORDER BY f.name
  LIMIT page_size
  OFFSET page_offset;
$function$;
