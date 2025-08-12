import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, metadata?: any) => Promise<any>;
  signInWithGoogle: () => Promise<any>;
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

              if (userError || !userData) return;

              const { data: workspace, error: workspaceError } = await supabase
                .from('workspaces')
                .select('plan_type')
                .eq('id', userData.workspace_id)
                .single();

              if (workspaceError || !workspace) return;

              if (workspace.plan_type === 'freemium') {
                const { data: trial, error: trialError } = await supabase
                  .from('workspace_trials')
                  .select('expires_at')
                  .eq('workspace_id', userData.workspace_id)
                  .single();

                if (!trialError && trial && new Date(trial.expires_at) <= new Date()) {
                  // Trial expired, sign out user
                  await supabase.auth.signOut();
                }
              }
            } catch (error) {
              console.error('Error checking trial status:', error);
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
          const { data: workspace, error: workspaceError } = await supabase
            .from('workspaces')
            .select('plan_type')
            .eq('id', userData.workspace_id)
            .single();

          if (!workspaceError && workspace && workspace.plan_type === 'freemium') {
            const { data: trial, error: trialError } = await supabase
              .from('workspace_trials')
              .select('expires_at')
              .eq('workspace_id', userData.workspace_id)
              .single();

            if (!trialError && trial && new Date(trial.expires_at) <= new Date()) {
              // Trial expired, sign out immediately and return error
              await supabase.auth.signOut();
              return { 
                data: null, 
                error: { 
                  message: 'Votre période d\'essai est expirée. Contactez notre équipe commerciale pour souscrire à un plan payant.' 
                } 
              };
            }
          }
        }
      } catch (trialError) {
        console.error('Error checking trial status during login:', trialError);
      }
    }

    return { data, error };
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
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
        redirectTo: `${window.location.origin}/search`,
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