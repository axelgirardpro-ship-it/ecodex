import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const useSupraAdmin = () => {
  const { user } = useAuth();
  const [isSupraAdmin, setIsSupraAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSupraAdmin = async () => {
      if (!user) {
        setIsSupraAdmin(false);
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc('is_supra_admin', {
          user_uuid: user.id
        });

        if (error) {
          console.error('Error checking supra admin status:', error);
          setIsSupraAdmin(false);
        } else {
          setIsSupraAdmin(data || false);
        }
      } catch (error) {
        console.error('Error in supra admin check:', error);
        setIsSupraAdmin(false);
      }

      setLoading(false);
    };

    checkSupraAdmin();
  }, [user]);

  return { isSupraAdmin, loading };
};