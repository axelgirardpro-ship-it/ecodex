import { useState, useEffect } from "react";
import { UnifiedNavbar } from "@/components/ui/UnifiedNavbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Shield, 
  Users, 
  Building, 
  Database, 
  Search,
  Activity,
  AlertTriangle,
  Download,
  Heart
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupraAdmin } from "@/hooks/useSupraAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { CompaniesTable } from "@/components/admin/CompaniesTable";
import { FreemiumCompaniesTable } from "@/components/admin/FreemiumCompaniesTable";
import { ContactsTable } from "@/components/admin/ContactsTable";
import { EmissionFactorAccessManager } from "@/components/admin/EmissionFactorAccessManager";
import { SourceWorkspaceAssignments } from "@/components/admin/SourceWorkspaceAssignments";
import { CreateSupraAdmin } from "@/components/admin/CreateSupraAdmin";
import { OrphanUsersCleanup } from "@/components/admin/OrphanUsersCleanup";

const Admin = () => {
  const { user } = useAuth();
  const { isSupraAdmin, loading: supraAdminLoading } = useSupraAdmin();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalCompanies: 0,
    totalSearches: 0,
    activeFavorites: 0,
    totalExports: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAdminStats = async () => {
      if (!user || !isSupraAdmin) {
        setLoading(false);
        return;
      }

      try {
        // Count users
        const { count: userCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true });

        // Count workspaces
        const { count: companyCount } = await supabase
          .from('workspaces')
          .select('*', { count: 'exact', head: true });

        // Count search quotas (proxy for active users)
        const { count: searchCount } = await supabase
          .from('search_quotas')
          .select('searches_used', { count: 'exact', head: true });

        // Count favorites
        const { count: favoritesCount } = await supabase
          .from('favorites')
          .select('*', { count: 'exact', head: true });

        // Count total exports
        const { data: quotas } = await supabase.from('search_quotas').select('exports_used');
        const totalExports = quotas?.reduce((sum, quota) => sum + (quota.exports_used || 0), 0) || 0;

        setStats({
          totalUsers: userCount || 0,
          totalCompanies: companyCount || 0,
          totalSearches: searchCount || 0,
          activeFavorites: favoritesCount || 0,
          totalExports: totalExports,
        });
      } catch (error) {
        console.error('Error loading admin stats:', error);
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Erreur lors du chargement des statistiques",
        });
      } finally {
        setLoading(false);
      }
    };

    loadAdminStats();
  }, [user, isSupraAdmin, toast]);

  // Show loading while checking permissions
  if (supraAdminLoading) {
    return (
      <div className="min-h-screen bg-background">
        <UnifiedNavbar />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Vérification des permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect if not supra admin
  if (!user || !isSupraAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <UnifiedNavbar />
        <div className="container mx-auto px-4 py-8">
          <Alert className="max-w-2xl mx-auto">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Accès refusé. Cette page est réservée aux supra administrateurs globaux.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center homepage-text">
            <Shield className="w-8 h-8 mr-3 text-primary" />
            Console d'administration
          </h1>
          <p className="text-muted-foreground">
            Gestion avancée de la plateforme DataCarb
          </p>
          <div className="mt-4">
            <Badge variant="default" className="mr-2 bg-gradient-to-r from-purple-600 to-blue-600">
              Supra Admin
            </Badge>
            <Badge variant="outline">
              {user.email}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground">
                Comptes actifs
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Entreprises</CardTitle>
              <Building className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalCompanies}</div>
              <p className="text-xs text-muted-foreground">
                Workspaces créés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recherches</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSearches}</div>
              <p className="text-xs text-muted-foreground">
                Sessions actives
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Favoris</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeFavorites}</div>
              <p className="text-xs text-muted-foreground">
                Éléments sauvegardés
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Exports totaux</CardTitle>
              <Download className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExports}</div>
              <p className="text-xs text-muted-foreground">
                Limite: 100/mois/utilisateur
              </p>
            </CardContent>
          </Card>
          
        </div>


        {/* Admin Components */}
        <div className="space-y-6">
          {/* Entreprises Dashboard */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Gestion des Entreprises</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <CompaniesTable />
              <FreemiumCompaniesTable />
            </div>
          </div>
          
          <ContactsTable />
          
          <EmissionFactorAccessManager />
          <SourceWorkspaceAssignments />
          
          {/* Supra Admin Creation */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Gestion des Comptes Admin</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <CreateSupraAdmin />
              <OrphanUsersCleanup />
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Informations de debug</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p><strong>User ID:</strong> {user.id}</p>
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Supra Admin:</strong> {isSupraAdmin ? 'Oui' : 'Non'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;