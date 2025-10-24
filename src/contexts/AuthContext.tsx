import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: Record<string, unknown>) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check trial access for freemium workspaces
        if (session?.user) {
          setTimeout(async () => {
            try {
              const { data: userData, error: userError } = await supabase
                .from('users')
                .select('workspace_id')
                .eq('user_id', session.user.id)
                .single();

              // Gestion d'erreur silencieuse comme dans UserContext
              if (userError) {
                if (userError.code !== 'PGRST116') {
                  // Log une seule fois par session les erreurs non-404
                  const errorKey = `auth_user_fetch_error_${userError.code}_${session.user.id}`;
                  if (!sessionStorage.getItem(errorKey)) {
                    console.error('Error fetching user in auth:', userError);
                    sessionStorage.setItem(errorKey, 'logged');
                  }
                }
                return; // Sortir silencieusement en cas d'erreur
              }

              if (!userData) return;

              const { data: hasAccess, error: accessErr } = await supabase
                .rpc('workspace_has_access', { workspace_uuid: userData.workspace_id });

              if (!accessErr && hasAccess === false) {
                try { sessionStorage.setItem('trial_expired', 'true'); } catch {}
                await supabase.auth.signOut();
                try {
                  const currentUrl = new URL(window.location.href);
                  if (currentUrl.pathname !== '/login') {
                    window.location.replace('/login?trial_expired=true');
                  }
                } catch {}
              }
            } catch (error) {
              // Log global error une seule fois par session
              const errorKey = `auth_trial_check_error_${session.user.id}`;
              if (!sessionStorage.getItem(errorKey)) {
                console.error('Error checking trial status:', error);
                sessionStorage.setItem(errorKey, 'logged');
              }
            }
          }, 0);
        }
        
        setLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // If login successful, check trial status for freemium plans
    if (data?.user && !error) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('workspace_id')
          .eq('user_id', data.user.id)
          .single();

        if (!userError && userData) {
          const { data: hasAccess, error: accessErr } = await supabase
            .rpc('workspace_has_access', { workspace_uuid: userData.workspace_id });

          if (!accessErr && hasAccess === false) {
            await supabase.auth.signOut();
            try { sessionStorage.setItem('trial_expired', 'true'); } catch {}
            return {
              data: null,
              error: {
                message: "Votre période d'essai de 7 jours est expirée. Contactez notre équipe commerciale pour souscrire à un plan.",
                code: 'TRIAL_EXPIRED'
              }
            };
          }
        }
      } catch (trialError) {
        console.error('Error checking trial status during login:', trialError);
      }
    }

    return { data, error };
  };

  const signUp = async (email: string, password: string, metadata?: Record<string, unknown>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    });
    return { data, error };
  };

  const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    
    // Note: For OAuth, trial checking will be handled in the auth state change listener
    // since the user data won't be immediately available here
    return { data, error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading,
      signOut,
      signIn,
      signUp,
      signInWithGoogle,
    }}>
      {children}
    </AuthContext.Provider>
  );
};