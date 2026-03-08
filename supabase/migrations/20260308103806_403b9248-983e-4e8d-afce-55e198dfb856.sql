
-- Fix search_path warnings
ALTER FUNCTION public.generate_display_name(text) SET search_path TO 'public';
ALTER FUNCTION public.trigger_set_display_name() SET search_path TO 'public';
