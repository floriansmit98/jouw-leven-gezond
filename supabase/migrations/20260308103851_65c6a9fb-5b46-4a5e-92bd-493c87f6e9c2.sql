
-- Fix compound pattern to only match letter-based words (not numbers like "0-50")
CREATE OR REPLACE FUNCTION public.generate_display_name(raw_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $func$
DECLARE
  result text;
  matches text[];
BEGIN
  result := raw_name;

  -- Step 1: Handle NEVO compound "Word Modifier- rest" → "modifierword rest"
  -- Only match when both parts are letters (avoids "Water 0-50" false positives)
  matches := regexp_match(result, '^([A-Za-zÀ-ÿ]+)\s+([A-Za-zÀ-ÿ]+)-\s*(.*)$');
  IF matches IS NOT NULL THEN
    result := lower(matches[2]) || lower(matches[1]);
    IF matches[3] IS NOT NULL AND trim(matches[3]) != '' THEN
      result := result || ' ' || trim(matches[3]);
    END IF;
  END IF;

  -- Step 2: Expand abbreviations
  result := regexp_replace(result, '\mz\.\s*', 'zonder ', 'gi');
  result := regexp_replace(result, '(?<=\s)z(?=\s)', 'zonder', 'gi');
  result := regexp_replace(result, '(?<=\s)m(?=\s)', 'met', 'gi');
  result := regexp_replace(result, '\mgem\M', 'gemiddeld', 'gi');
  result := regexp_replace(result, '\mgeb\M', 'gebakken', 'gi');
  result := regexp_replace(result, '\mgek\M', 'gekookt', 'gi');
  result := regexp_replace(result, '\mgedr\M', 'gedroogd', 'gi');
  result := regexp_replace(result, '\mgest\M', 'gestoomd', 'gi');
  result := regexp_replace(result, '\mongeb\M', 'ongebakken', 'gi');
  result := regexp_replace(result, '\mgeconc\M', 'geconcentreerd', 'gi');
  result := regexp_replace(result, '\mgepast\M', 'gepasteuriseerd', 'gi');
  result := regexp_replace(result, '\mversch\M', 'verschillende', 'gi');
  result := regexp_replace(result, '\mhalvv\M', 'halfvol', 'gi');
  result := regexp_replace(result, '\mongesl\M', 'ongeslepen', 'gi');
  result := regexp_replace(result, '\mgesl\M', 'geslepen', 'gi');
  result := regexp_replace(result, '\mongez\M', 'ongezouten', 'gi');
  result := regexp_replace(result, '\mgez\M', 'gezouten', 'gi');
  result := regexp_replace(result, '\mverr\M', 'verrijkt', 'gi');
  result := regexp_replace(result, '\mvit\M', 'vitamine', 'gi');

  -- Step 3: Remove trailing "gemiddeld"
  result := regexp_replace(result, '[,\s]*gemiddeld\s*$', '', 'i');

  -- Step 4: Clean up dashes between letters, extra spaces
  result := regexp_replace(result, '(?<=[A-Za-zÀ-ÿ])\s*-\s*(?=[A-Za-zÀ-ÿ])', '', 'g');
  result := regexp_replace(result, ',\s*$', '', 'g');
  result := regexp_replace(result, '\s+', ' ', 'g');
  result := trim(result);

  -- Step 5: Capitalize first letter only
  IF length(result) > 0 THEN
    result := upper(left(result, 1)) || substring(result from 2);
  END IF;

  RETURN result;
END;
$func$;

-- Re-generate all display names
UPDATE public.foods SET display_name = public.generate_display_name(name);
