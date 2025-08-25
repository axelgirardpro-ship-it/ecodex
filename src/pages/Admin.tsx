import { useState, useEffect } from "react";
import { UnifiedNavbar } from "@/components/ui/UnifiedNavbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupraAdmin } from "@/hooks/useSupraAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WorkspacesTable } from "@/components/admin/WorkspacesTable";
import { ContactsTable } from "@/components/admin/ContactsTable";
import { SourcesPanel } from "@/components/admin/SourcesPanel";
import { FeSourcesProvider } from '@/contexts/FeSourcesContext'
import { CreateSupraAdmin } from "@/components/admin/CreateSupraAdmin";
import { OrphanUsersRepair } from "@/components/admin/OrphanUsersRepair";
import { AdminImportsPanel } from "@/components/admin/AdminImportsPanel";

const Admin = () => {
  const { user } = useAuth();
  const { isSupraAdmin, loading: supraAdminLoading } = useSupraAdmin();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(false);
  }, [user, isSupraAdmin]);

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

        {/* KPIs supprimés pour épurer l'admin */}


        {/* Admin Components */}
        <div className="space-y-6">
          {/* Entreprises Dashboard */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Gestion des Entreprises</h2>
            <WorkspacesTable />
          </div>
          
          <ContactsTable />
          
          <FeSourcesProvider>
            <SourcesPanel />
          </FeSourcesProvider>

          <div>
            <h2 className="text-2xl font-bold mb-4">Import de la base (FR)</h2>
            <AdminImportsPanel />
          </div>

          {/* Supra Admin Creation */}
          <div>
            <h2 className="text-2xl font-bold mb-4">Gestion des Comptes Admin</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              <CreateSupraAdmin />
              <OrphanUsersRepair />
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