import { useState, useEffect } from "react";
import { getAdminWorkspaces, invokeWithAuth } from '@/lib/adminApi'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Building2, Users, Calendar, UserCheck, Edit, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface FreemiumCompany {
  id: string;
  name: string;
  owner_id: string;
  plan_type: string;
  created_at: string;
  updated_at: string;
  user_count?: number;
  owner_email?: string;
  subscription_status?: {
    plan_type: string;
    subscribed: boolean;
  };
}

export const FreemiumCompaniesTable = () => {
  const [companies, setCompanies] = useState<FreemiumCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchFreemiumCompanies();
  }, []);

  const fetchFreemiumCompanies = async () => {
    try {
      setLoading(true);
      
      // Use edge function to get freemium workspaces
      const rows = await getAdminWorkspaces('freemium')
      setCompanies(rows as FreemiumCompany[])
    } catch (error) {
      console.error('Error fetching freemium companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async (workspaceId: string, newPlan: string) => {
    setUpdating(workspaceId);
    try {
      const { data, error } = await invokeWithAuth('update-user-plan-role', {
        body: { 
          action: 'update_workspace_plan', 
          workspaceId, 
          newPlan 
        }
      });

      if (error) throw error;

      toast({
        title: "Plan mis à jour",
        description: `Plan changé vers ${newPlan}. ${data.updatedUsers} utilisateur(s) mis à jour.`,
      });

      // Recharger les données
      await fetchFreemiumCompanies();
    } catch (error) {
      console.error('Error updating plan:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la mise à jour du plan",
      });
    } finally {
      setUpdating(null);
    }
  };

  const deleteWorkspace = async (workspaceId: string, workspaceName: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'entreprise "${workspaceName}" ? Cette action est irréversible et supprimera tous les utilisateurs et données associés.`)) {
      return;
    }

    setDeleting(workspaceId);
    try {
      const { error } = await supabase.functions.invoke('delete-admin-entities', {
        body: { type: 'workspace', id: workspaceId }
      });

      if (error) throw error;

      toast({
        title: "Entreprise supprimée",
        description: `L'entreprise "${workspaceName}" a été supprimée avec succès.`,
      });

      await fetchFreemiumCompanies();
    } catch (error) {
      console.error('Error deleting workspace:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la suppression de l'entreprise",
      });
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Entreprises Freemium
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Entreprises Freemium ({companies.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entreprise</TableHead>
              <TableHead>Propriétaire</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Utilisateurs</TableHead>
              <TableHead>Créée le</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {companies.map((company) => (
              <TableRow key={company.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div>{company.name}</div>
                      <div className="text-xs text-muted-foreground">ID: {company.id.slice(0, 8)}...</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    {company.owner_email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {company.subscription_status?.plan_type || company.plan_type}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {company.user_count}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(company.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={company.subscription_status?.plan_type || company.plan_type}
                      onValueChange={(newPlan) => handlePlanChange(company.id, newPlan)}
                      disabled={updating === company.id}
                    >
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="freemium">Freemium</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteWorkspace(company.id, company.name)}
                      disabled={updating === company.id || deleting === company.id}
                    >
                      {deleting === company.id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                    {updating === company.id && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune entreprise freemium trouvée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};