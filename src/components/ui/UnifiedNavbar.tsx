import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSupraAdmin } from "@/hooks/useSupraAdmin";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuotas } from "@/hooks/useQuotas";
import { useEmissionFactorAccess } from "@/hooks/useEmissionFactorAccess";
import { NavbarQuotaWidget } from "@/components/ui/NavbarQuotaWidget";
import { Lock } from "lucide-react";

export const UnifiedNavbar = () => {
  const { user, signOut } = useAuth();
  const { isSupraAdmin } = useSupraAdmin();
  const { canUseFavorites } = useEmissionFactorAccess();
  const { canImportData } = usePermissions();
  const { quotaData, isLoading, isAtLimit } = useQuotas();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <nav className="border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to={user ? "/search" : "/"} className="flex items-center">
              <img src="/assets/6c4e21a7-850d-42ab-8370-017b8e71d180.png" alt="DataCarb" className="h-10" />
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <div className="hidden md:block">
                  <NavbarQuotaWidget quotaData={quotaData} isLoading={isLoading} isAtLimit={isAtLimit} />
                </div>
            <Link to="/search">
              <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                Recherche
              </Button>
            </Link>
            {canUseFavorites() ? (
              <Link to="/favoris">
                <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                  Favoris
                </Button>
              </Link>
            ) : (
              <Button 
                variant="ghost" 
                className="text-foreground opacity-50 cursor-not-allowed"
                disabled
                title="Fonctionnalité disponible uniquement avec le plan Premium"
              >
                <Lock className="h-4 w-4 mr-2" />
                Favoris
              </Button>
            )}
            {canImportData ? (
              <Link to="/import">
                <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                  Import
                </Button>
              </Link>
            ) : (
              <Button 
                variant="ghost" 
                className="text-foreground opacity-50 cursor-not-allowed"
                disabled
                title="Réservé aux workspaces Premium"
              >
                <Lock className="h-4 w-4 mr-2" />
                Import
              </Button>
            )}
            <Link to="/settings">
              <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                Paramètres
              </Button>
            </Link>
            <Button 
              onClick={handleSignOut}
              variant="outline" 
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
            >
              Se déconnecter
            </Button>
              </>
            ) : (
              <>
            <Link to="/signup">
              <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                S'inscrire
              </Button>
            </Link>
            <Link to="/login">
              <Button>
                Se connecter
              </Button>
            </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};