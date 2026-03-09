import { useState, useEffect } from 'react';

const STORAGE_KEY = 'niercoach_recent_searches';
const MAX_RECENT = 8;

export function useRecentSearches() {
  const [searches, setSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const addSearch = (query: string) => {
    const trimmed = query.trim().toLowerCase();
    if (trimmed.length < 2) return;
    setSearches(prev => {
      const filtered = prev.filter(s => s !== trimmed);
      const updated = [trimmed, ...filtered].slice(0, MAX_RECENT);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const clearSearches = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSearches([]);
  };

  return { searches, addSearch, clearSearches };
}
