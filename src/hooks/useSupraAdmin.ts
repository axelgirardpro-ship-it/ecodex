import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { queryKeys } from '@/lib/queryKeys';

const checkSupraAdmin = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase.rpc('is_supra_admin', {
    user_uuid: userId
  });
  if (error) {
    console.error('Error checking supra admin status:', error);
    return false;
  }
  return data || false;
};

export const useSupraAdmin = () => {
  const { user } = useAuth();

  const { data: isSupraAdmin = false, isLoading: loading } = useQuery({
    queryKey: queryKeys.permissions.supraAdmin(user?.id || ''),
    queryFn: () => checkSupraAdmin(user!.id),
    enabled: !!user?.id,
    staleTime: Infinity, // Cache infini pendant la session
    gcTime: Infinity,
  });

  return { isSupraAdmin, loading };
};