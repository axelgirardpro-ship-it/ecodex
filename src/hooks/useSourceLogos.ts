import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { queryKeys } from '@/lib/queryKeys';

interface SourceLogo {
  source: string;
  logoUrl: string | null;
}

// Default logos mapping for common sources
const DEFAULT_LOGOS: Record<string, string> = {
  'PCAF': '/public/assets/pcaf-logo.png',
  'CBAM': '/public/assets/cbam-logo.png',
  'ADEME': '/public/assets/ademe-logo.png',
  'GHG Protocol': '/public/assets/ghg-protocol-logo.png',
  // Ajoutez ici d'autres sources avec leurs logos par défaut
};

const fetchSourceLogos = async () => {
  const { data: files, error } = await supabase.storage
    .from('source-logos')
    .list();

  if (error) {
    console.error('Error fetching source logos:', error);
    return DEFAULT_LOGOS;
  }

  const logoMap: Record<string, string> = { ...DEFAULT_LOGOS };

  for (const file of files || []) {
    if (file.name && file.name !== '.emptyFolderPlaceholder') {
      const { data } = supabase.storage
        .from('source-logos')
        .getPublicUrl(file.name);

      if (data?.publicUrl) {
        const sourceName = file.name.replace(/\.(jpg|jpeg|png|svg|webp)$/i, '');
        logoMap[sourceName] = data.publicUrl;
      }
    }
  }

  return logoMap;
};

export const useSourceLogos = () => {
  const { data: logos = {}, isLoading: loading } = useQuery({
    queryKey: queryKeys.logos.all,
    queryFn: fetchSourceLogos,
    staleTime: 86400000, // 24 heures (données statiques)
    gcTime: 86400000,
  });

  const getSourceLogo = useCallback((source: string): string | null => {
    if (!source) return null;
    
    // Try exact match first
    if (logos[source]) return logos[source];
    
    // Try case-insensitive match
    const normalizedSource = source.toLowerCase();
    const matchingKey = Object.keys(logos).find(key => 
      key.toLowerCase() === normalizedSource
    );
    
    return matchingKey ? logos[matchingKey] : null;
  }, [logos]);

  return {
    getSourceLogo,
    loading,
    logos
  };
};