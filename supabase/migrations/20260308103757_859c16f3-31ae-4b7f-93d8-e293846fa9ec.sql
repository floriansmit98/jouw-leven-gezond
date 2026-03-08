
-- Create a comprehensive function to generate user-friendly Dutch food names
CREATE OR REPLACE FUNCTION public.generate_display_name(raw_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $func$
DECLARE
  result text;
  matches text[];
  base_word text;
  modifier text;
  rest text;
BEGIN
  result := raw_name;

  -- Step 1: Handle NEVO compound pattern "X Y- rest" → "yx rest"
  -- e.g. "wafel stroop- gemiddeld" → "stroopwafel gemiddeld"
  -- e.g. "soep tomaten- met balletjes" → "tomatensoep met balletjes"
  matches := regexp_match(result, '^(\S+)\s+(\S+)-\s*(.*)$');
  IF matches IS NOT NULL THEN
    base_word := lower(matches[1]);
    modifier := lower(matches[2]);
    rest := COALESCE(trim(matches[3]), '');
    result := modifier || base_word;
    IF rest != '' THEN
      result := result || ' ' || rest;
    END IF;
  END IF;

  -- Step 2: Expand abbreviations (use \m \M for word boundaries)
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

  -- Step 3: Remove trailing "gemiddeld" (just means "average variant", not useful)
  result := regexp_replace(result, '[,\s]*gemiddeld\s*$', '', 'i');

  -- Step 4: Clean up dashes, extra spaces, commas at end
  result := regexp_replace(result, '\s*-\s*', ' ', 'g');
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

-- Re-generate ALL display names from the original raw name
UPDATE public.foods SET display_name = public.generate_display_name(name);

-- Auto-generate display_name on insert/update via trigger
CREATE OR REPLACE FUNCTION public.trigger_set_display_name()
RETURNS trigger
LANGUAGE plpgsql
AS $func$
BEGIN
  IF NEW.display_name IS NULL OR NEW.display_name = NEW.name THEN
    NEW.display_name := public.generate_display_name(NEW.name);
  END IF;
  RETURN NEW;
END;
$func$;

DROP TRIGGER IF EXISTS set_display_name_on_foods ON public.foods;
CREATE TRIGGER set_display_name_on_foods
  BEFORE INSERT OR UPDATE OF name ON public.foods
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_display_name();
