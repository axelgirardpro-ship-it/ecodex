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

      // Gérer les erreurs de récupération des données utilisateur
      if (userError) {
        if (userError.code === 'PGRST116') {
          // Pas de données trouvées - Utilisateur dans auth.users mais pas dans public.users
          // Cela peut indiquer un échec de la fonction handle_new_user
          console.warn(`User ${user.id} exists in auth but not in public.users. This indicates data inconsistency.`);
          
          // Au lieu de créer un profil minimal avec workspace_id vide, 
          // on se contente de définir le profil comme null
          // Cela évite les appels API avec des IDs invalides
          setUserProfile(null);
          setLoading(false);
          return;
        } else {
          // Log une seule fois par session les erreurs non-404
          const errorKey = `user_fetch_error_${userError.code}_${user.id}`;
          if (!sessionStorage.getItem(errorKey)) {
            console.error('Error fetching user profile:', userError);
            sessionStorage.setItem(errorKey, 'logged');
          }
          
          // Pour les autres erreurs, on ne crée pas de profil minimal non plus
          setUserProfile(null);
          setLoading(false);
          return;
        }
      }

      // Then get role data with error handling
      let roleData = null;
      try {
        const { data } = await supabase
          .from('user_roles')
          .select('role, workspace_id')
          .eq('user_id', user.id)
          .limit(1)
          .single();
        roleData = data;
      } catch (roleError) {
        // Ignorer silencieusement les erreurs de rôle pour éviter la pollution des logs
      }

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
      // Log global error une seule fois par session
      const errorKey = `profile_fetch_error_${user.id}`;
      if (!sessionStorage.getItem(errorKey)) {
        console.error('Error in fetchProfile:', error);
        sessionStorage.setItem(errorKey, 'logged');
      }
      
      // En cas d'erreur globale, ne pas créer de profil minimal
      // Cela évite de créer des utilisateurs avec workspace_id vide
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