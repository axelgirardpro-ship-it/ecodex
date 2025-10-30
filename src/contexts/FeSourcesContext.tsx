import React from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface FeSource { 
  source_name: string; 
  access_level: 'free'|'paid';
  record_count?: number;
}

interface FeSourcesContextValue {
  sources: FeSource[]
  refresh: () => Promise<void>
  loading: boolean
}

const Ctx = React.createContext<FeSourcesContextValue | undefined>(undefined)

export const FeSourcesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sources, setSources] = React.useState<FeSource[]>([])
  const [loading, setLoading] = React.useState(true)
  const lastFetchRef = React.useRef(0)

  const fetchOnce = React.useCallback(async (force = false) => {
    const now = Date.now()
    if (!force && now - lastFetchRef.current < 5000) return
    lastFetchRef.current = now
    setLoading(true)
    const { data, error } = await supabase
      .from('fe_sources')
      .select('source_name, access_level')
      .eq('is_global', true)
      .order('source_name')
    if (!error) setSources((data || []) as FeSource[])
    setLoading(false)
  }, [])

  React.useEffect(() => { fetchOnce(true) }, [fetchOnce])

  // Realtime: DÉSACTIVÉ temporairement pour éliminer les erreurs console
  // Les sources sont cachées 5 minutes via React Query (useEmissionFactorAccess)
  // Les changements seront visibles après refresh ou invalidation cache
  // Réactiver quand la configuration Supabase Realtime sera corrigée
  /*
  React.useEffect(() => {
    const ch = supabase
      .channel('fe-sources-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'fe_sources', filter: 'is_global=eq.true' },
        () => { fetchOnce(true) }
      )
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [fetchOnce])
  */

  const value: FeSourcesContextValue = React.useMemo(() => ({ sources, refresh: () => fetchOnce(true), loading }), [sources, fetchOnce, loading])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFeSources() {
  const v = React.useContext(Ctx)
  if (!v) throw new Error('useFeSources must be used within FeSourcesProvider')
  return v
}


