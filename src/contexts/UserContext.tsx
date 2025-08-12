import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './AuthContext';

interface UserProfile {
  user_id: string;
  workspace_id: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  position?: string;
  phone?: string;
  email: string;
  plan_type?: string;
  subscribed?: boolean;
  role?: string;
}

interface UserContextType {
  userProfile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async () => {
    if (!user) {
      setUserProfile(null);
      setLoading(false);
      return;
    }

    try {
      // First get user data from the users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (userError && userError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', userError);
        setUserProfile(null);
        setLoading(false);
        return;
      }

      // Then get role data
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role, workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      const profile: UserProfile = {
        user_id: user.id,
        workspace_id: userData?.workspace_id || roleData?.workspace_id || '',
        first_name: userData?.first_name,
        last_name: userData?.last_name,
        company: userData?.company,
        position: userData?.position,
        phone: userData?.phone,
        email: userData?.email || user.email || '',
        plan_type: userData?.plan_type,
        subscribed: userData?.subscribed,
        role: roleData?.role,
      };

      setUserProfile(profile);
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      setUserProfile(null);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const refreshProfile = async () => {
    setLoading(true);
    await fetchProfile();
  };

  return (
    <UserContext.Provider value={{
      userProfile,
      loading,
      refreshProfile,
    }}>
      {children}
    </UserContext.Provider>
  );
};