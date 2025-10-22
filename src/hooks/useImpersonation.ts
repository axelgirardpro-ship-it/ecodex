import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeWithAuth } from '@/lib/adminApi';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@supabase/supabase-js';

interface ImpersonatedUser {
  id: string;
  email: string;
  workspace_id: string;
  workspace_name: string;
}

interface ImpersonationState {
  isImpersonating: boolean;
  impersonatedUser: ImpersonatedUser | null;
  originalUser: User | null;
}

export const useImpersonation = () => {
  const { user } = useAuth();
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    impersonatedUser: null,
    originalUser: null,
  });

  useEffect(() => {
    // Check if we have impersonation data in sessionStorage
    const impersonationData = sessionStorage.getItem('impersonation_data');
    if (impersonationData) {
      try {
        const data = JSON.parse(impersonationData);
        setState(data);
      } catch (error) {
        console.error('Error parsing impersonation data:', error);
        sessionStorage.removeItem('impersonation_data');
      }
    }
  }, []);

  const startImpersonation = async (targetUserId: string, targetEmail: string, workspaceId: string, workspaceName: string) => {
    if (!user) return false;

    try {
      // Create a custom JWT token for the target user using an edge function
      const { data, error } = await invokeWithAuth('impersonate-user', {
        body: { 
          targetUserId,
          originalUserId: user.id
        }
      });

      if (error) throw error;

      const impersonationState = {
        isImpersonating: true,
        impersonatedUser: {
          id: targetUserId,
          email: targetEmail,
          workspace_id: workspaceId,
          workspace_name: workspaceName,
        },
        originalUser: user,
      };

      setState(impersonationState);
      sessionStorage.setItem('impersonation_data', JSON.stringify(impersonationState));

      // Set the new session with the impersonated user's tokens
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });
      }

      return true;
    } catch (error) {
      console.error('Error starting impersonation:', error);
      return false;
    }
  };

  const stopImpersonation = async () => {
    if (!state.originalUser) return false;

    try {
      // Create a JWT token for the original user
      const { data, error } = await invokeWithAuth('stop-impersonation', {
        body: { 
          originalUserId: state.originalUser.id
        }
      });

      if (error) throw error;

      // Restore original session
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token
        });
      }

      setState({
        isImpersonating: false,
        impersonatedUser: null,
        originalUser: null,
      });
      sessionStorage.removeItem('impersonation_data');

      return true;
    } catch (error) {
      console.error('Error stopping impersonation:', error);
      return false;
    }
  };

  return {
    ...state,
    startImpersonation,
    stopImpersonation,
  };
};