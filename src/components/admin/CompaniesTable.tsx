import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminWorkspaces } from '@/lib/adminApi'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, Calendar, Crown, Edit, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface Company {
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

export const CompaniesTable = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      
      // Get only paying workspaces (standard and premium)
      const rows = await getAdminWorkspaces('paid')
      const payingCompanies = rows.filter((company: Company) => 
        company.plan_type === 'standard' || company.plan_type === 'premium'
      );
      setCompanies(payingCompanies);
    } catch (error) {
      console.error('Error fetching companies:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateWorkspacePlan = async (workspaceId: string, newPlan: string) => {
    try {
      const { error } = await supabase
        .from('workspaces')
        .update({ plan_type: newPlan })
        .eq('id', workspaceId);

      if (error) throw error;

      toast({
        title: "Plan mis à jour",
        description: `Le plan a été changé pour ${newPlan}.`,
      });

      // Refresh the companies list
      fetchCompanies();
      setEditingPlan(null);
    } catch (error) {
      console.error('Error updating workspace plan:', error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le plan.",
        variant: "destructive",
      });
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

      fetchCompanies();
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

  const getPlanBadgeVariant = (planType: string) => {
    switch (planType) {
      case 'premium': return 'default';
      case 'standard': return 'secondary';
      case 'freemium': return 'outline';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Entreprises Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
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
          <Building2 className="h-5 w-5" />
          Entreprises Clientes ({companies.length})
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
                    <Crown className="h-4 w-4 text-amber-500" />
                    {company.owner_email}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getPlanBadgeVariant(company.subscription_status?.plan_type || company.plan_type)}>
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
                     {editingPlan === company.id ? (
                       <>
                         <Select
                           value={company.plan_type}
                           onValueChange={(value) => updateWorkspacePlan(company.id, value)}
                         >
                           <SelectTrigger className="w-32">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             <SelectItem value="freemium">Freemium</SelectItem>
                             <SelectItem value="standard">Standard</SelectItem>
                             <SelectItem value="premium">Premium</SelectItem>
                           </SelectContent>
                         </Select>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => setEditingPlan(null)}
                         >
                           Annuler
                         </Button>
                       </>
                     ) : (
                       <>
                         <Button
                           variant="outline"
                           size="sm"
                           onClick={() => setEditingPlan(company.id)}
                         >
                           <Edit className="h-4 w-4 mr-2" />
                           Modifier
                         </Button>
                         <Button
                           variant="destructive"
                           size="sm"
                           onClick={() => deleteWorkspace(company.id, company.name)}
                           disabled={deleting === company.id}
                         >
                           {deleting === company.id ? (
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                           ) : (
                             <Trash2 className="h-4 w-4" />
                           )}
                         </Button>
                       </>
                     )}
                   </div>
                 </TableCell>
               </TableRow>
            ))}
            {companies.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune entreprise avec plan payant trouvée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};