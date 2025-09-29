import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ImpersonationBanner } from "@/components/ui/ImpersonationBanner";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AuthCallback from "./pages/AuthCallback";

import { SearchDashboard } from "@/components/search/algolia/AlgoliaSearchDashboard";
import { FavorisAlgoliaDashboard } from "@/components/search/favoris/FavorisAlgoliaDashboard";
import Import from "./pages/Import";
import Settings from "./pages/SimplifiedSettings";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { LanguageProvider, SupportedLanguage, useLanguage } from "@/providers/LanguageProvider";
import { buildLocalizedPath } from "@i18n/routing";

const queryClient = new QueryClient();

// Composant pour protéger les routes authentifiées
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { language } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to={buildLocalizedPath("/login", language)} replace />;
  }

  return <>{children}</>;
};

// Composant pour les routes publiques (rediriger si connecté)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const { language } = useLanguage();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return <Navigate to={buildLocalizedPath("/search", language)} replace />;
  }

  return <>{children}</>;
};

const LanguageLayout = ({ lang }: { lang: SupportedLanguage }) => {
  const { setLanguage } = useLanguage();
  useEffect(() => {
    setLanguage(lang, { skipStorage: true });
  }, [lang, setLanguage]);

  return <Outlet />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <UserProvider>
        <WorkspaceProvider>
          <FavoritesProvider>
            <TooltipProvider>
                <Toaster />
                <Sonner />
                <BrowserRouter>
                  <LanguageProvider>
                    <div className="min-h-screen">
                      <ImpersonationBanner />
                      <Routes>
                        <Route element={<LanguageLayout lang="fr" />}>
                          <Route path="/" element={<Index />} />
                          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                          <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                          <Route path="/auth/callback" element={<AuthCallback />} />
                          <Route path="/search" element={<ProtectedRoute><SearchDashboard /></ProtectedRoute>} />
                          <Route path="/favoris" element={<ProtectedRoute><FavorisAlgoliaDashboard /></ProtectedRoute>} />
                          <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
                          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                          <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                        </Route>
                        <Route path="/en" element={<LanguageLayout lang="en" />}>
                          <Route index element={<Index />} />
                          <Route path="login" element={<PublicRoute><Login /></PublicRoute>} />
                          <Route path="signup" element={<PublicRoute><Signup /></PublicRoute>} />
                          <Route path="auth/callback" element={<AuthCallback />} />
                          <Route path="search" element={<ProtectedRoute><SearchDashboard /></ProtectedRoute>} />
                          <Route path="favoris" element={<ProtectedRoute><FavorisAlgoliaDashboard /></ProtectedRoute>} />
                          <Route path="import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
                          <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                          <Route path="admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                          <Route path="*" element={<NotFound />} />
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </div>
                  </LanguageProvider>
                </BrowserRouter>
            </TooltipProvider>
          </FavoritesProvider>
        </WorkspaceProvider>
      </UserProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
