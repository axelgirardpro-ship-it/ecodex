import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';
import { useUser } from './UserContext';

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  plan_type: string;
  created_at: string;
  updated_at: string;
  billing_company?: string;
  billing_address?: string;
  billing_postal_code?: string;
  billing_country?: string;
  billing_siren?: string;
  billing_vat_number?: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  loading: boolean;
  refreshWorkspace: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};

interface WorkspaceProviderProps {
  children: ReactNode;
}

export const WorkspaceProvider = ({ children }: WorkspaceProviderProps) => {
  const { user } = useAuth();
  const { userProfile, loading: userLoading } = useUser();
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspace = async () => {
    // Attendre que le profil soit chargé
    if (!user) {
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }
    if (userLoading) {
      setLoading(true);
      return;
    }
    // Validation : workspace_id requis
    if (!userProfile || !userProfile.workspace_id || userProfile.workspace_id.trim() === '') {
      setCurrentWorkspace(null);
      setLoading(false);
      return;
    }

    try {
      // Pour les utilisateurs normaux, récupérer uniquement leur workspace
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('id', userProfile.workspace_id)
        .single();

      if (error) {
        console.error('Error fetching workspace:', error);
        setCurrentWorkspace(null);
      } else {
        setCurrentWorkspace(data);
      }
    } catch (error) {
      console.error('Error in fetchWorkspace:', error);
      setCurrentWorkspace(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspace();
  }, [user, userProfile?.workspace_id, userLoading]);

  const refreshWorkspace = async () => {
    setLoading(true);
    await fetchWorkspace();
  };

  return (
    <WorkspaceContext.Provider value={{
      currentWorkspace,
      loading,
      refreshWorkspace,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};