import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getDialysisSchedule, getNextDialysisDatetime, getLimits } from '@/lib/store';
import type { FoodEntryRow } from './useFoods';

export function useDialysisPeriodEntries() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FoodEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const schedule = getDialysisSchedule();

  const lastEnd = schedule.lastDialysisEnd;

  useEffect(() => {
    if (!user || !lastEnd) {
      setEntries([]);
      setLoading(false);
      return;
    }

    supabase
      .from('food_entries')
      .select('*')
      .gte('logged_at', lastEnd)
      .order('logged_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error) setEntries((data ?? []) as FoodEntryRow[]);
        setLoading(false);
      });
  }, [user, lastEnd]);

  return { entries, loading, lastEnd };
}

export function useDialysisPeriodTotals() {
  const { entries, lastEnd } = useDialysisPeriodEntries();
  const schedule = getDialysisSchedule();
  const limits = getLimits();
  const nextDialysis = getNextDialysisDatetime(schedule);

  const totals = useMemo(() => ({
    potassium: entries.reduce((s, e) => s + Number(e.potassium_mg), 0),
    phosphate: entries.reduce((s, e) => s + Number(e.phosphate_mg), 0),
    sodium: entries.reduce((s, e) => s + Number(e.sodium_mg), 0),
    protein: entries.reduce((s, e) => s + Number(e.protein_g), 0),
    fluid: entries.reduce((s, e) => s + Number(e.fluid_ml), 0),
  }), [entries]);

  // Calculate how many days this period spans
  const periodDays = useMemo(() => {
    if (!lastEnd) return 1;
    const start = new Date(lastEnd);
    const end = nextDialysis || new Date();
    const diffMs = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }, [lastEnd, nextDialysis]);

  // Period limits = daily limits * number of days
  const periodLimits = useMemo(() => ({
    potassium: limits.potassium * periodDays,
    phosphate: limits.phosphate * periodDays,
    sodium: limits.sodium * periodDays,
    protein: limits.protein * periodDays,
    fluid: limits.fluid * periodDays,
  }), [limits, periodDays]);

  // Elapsed time since last dialysis
  const elapsedHours = useMemo(() => {
    if (!lastEnd) return 0;
    return Math.floor((Date.now() - new Date(lastEnd).getTime()) / (1000 * 60 * 60));
  }, [lastEnd]);

  // Overall status
  const overallStatus = useMemo(() => {
    const ratios = [
      totals.potassium / periodLimits.potassium,
      totals.phosphate / periodLimits.phosphate,
      totals.sodium / periodLimits.sodium,
      totals.fluid / periodLimits.fluid,
    ];
    const maxRatio = Math.max(...ratios);
    if (maxRatio >= 0.9) return 'above' as const;
    if (maxRatio >= 0.7) return 'caution' as const;
    return 'ontrack' as const;
  }, [totals, periodLimits]);

  return {
    totals,
    periodLimits,
    periodDays,
    elapsedHours,
    overallStatus,
    lastEnd,
    nextDialysis,
    schedule,
  };
}
