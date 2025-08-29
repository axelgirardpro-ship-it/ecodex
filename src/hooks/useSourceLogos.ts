import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

export const useSourceLogos = () => {
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogos = async () => {
      try {
        // quiet logs
        // Get list of files in the source-logos bucket
        const { data: files, error } = await supabase.storage
          .from('source-logos')
          .list();

        if (error) {
          console.error('❌ Error fetching source logos:', error);
          // Use default logos as fallback
          setLogos(DEFAULT_LOGOS);
          return;
        }

        // quiet logs
        const logoMap: Record<string, string> = { ...DEFAULT_LOGOS };

        // For each file, get the public URL and extract source name
        for (const file of files || []) {
          if (file.name && file.name !== '.emptyFolderPlaceholder') {
            const { data } = supabase.storage
              .from('source-logos')
              .getPublicUrl(file.name);

            if (data?.publicUrl) {
              // Extract source name from filename (remove extension)
              const sourceName = file.name.replace(/\.(jpg|jpeg|png|svg|webp)$/i, '');
              // quiet logs
              logoMap[sourceName] = data.publicUrl;
            }
          }
        }

        // quiet logs
        setLogos(logoMap);
      } catch (error) {
        console.error('❌ Error in fetchLogos:', error);
        setLogos(DEFAULT_LOGOS);
      } finally {
        setLoading(false);
      }
    };

    fetchLogos();
  }, []);

  const getSourceLogo = (source: string): string | null => {
    if (!source) return null;
    
    // Try exact match first
    if (logos[source]) return logos[source];
    
    // Try case-insensitive match
    const normalizedSource = source.toLowerCase();
    const matchingKey = Object.keys(logos).find(key => 
      key.toLowerCase() === normalizedSource
    );
    
    return matchingKey ? logos[matchingKey] : null;
  };

  return {
    getSourceLogo,
    loading,
    logos
  };
};