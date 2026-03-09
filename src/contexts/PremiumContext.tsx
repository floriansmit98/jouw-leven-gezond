import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PremiumContextType {
  isPremium: boolean;
  loading: boolean;
  unlock: () => Promise<void>;
}

const PremiumContext = createContext<PremiumContextType>({
  isPremium: false,
  loading: true,
  unlock: async () => {},
});

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsPremium(false);
      setLoading(false);
      return;
    }

    supabase
      .from('profiles')
      .select('is_premium')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        setIsPremium(data?.is_premium ?? false);
        setLoading(false);
      });
  }, [user]);

  const unlock = async () => {
    if (!user) return;
    const { error } = await supabase
      .from('profiles')
      .update({ is_premium: true } as any)
      .eq('id', user.id);
    if (!error) setIsPremium(true);
  };

  return (
    <PremiumContext.Provider value={{ isPremium, loading, unlock }}>
      {children}
    </PremiumContext.Provider>
  );
}

export const usePremium = () => useContext(PremiumContext);
