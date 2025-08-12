import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { ImpersonationBanner } from "@/components/ui/ImpersonationBanner";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

import { SearchDashboard } from "@/components/search/algolia/AlgoliaSearchDashboard";
import { FavorisAlgoliaDashboard } from "@/components/search/favoris/FavorisAlgoliaDashboard";
import Import from "./pages/Import";
import SimplifiedSettings from "./pages/SimplifiedSettings";
import Debug from "./pages/Debug";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import DevLogin from "./pages/DevLogin";

const queryClient = new QueryClient();

// Composant pour protéger les routes authentifiées
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
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
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Composant pour les routes publiques (rediriger si connecté)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  
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
    return <Navigate to="/search" replace />;
  }
  
  return <>{children}</>;
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
                <div className="min-h-screen">
                  <ImpersonationBanner />
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                    <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
                    <Route path="/dev" element={<PublicRoute><DevLogin /></PublicRoute>} />
                    <Route path="/search" element={<ProtectedRoute><SearchDashboard /></ProtectedRoute>} />
                    <Route path="/favoris" element={<ProtectedRoute><FavorisAlgoliaDashboard /></ProtectedRoute>} />
                    <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><SimplifiedSettings /></ProtectedRoute>} />
                    <Route path="/debug" element={<ProtectedRoute><Debug /></ProtectedRoute>} />
                    <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </div>
              </BrowserRouter>
            </TooltipProvider>
          </FavoritesProvider>
        </WorkspaceProvider>
      </UserProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
