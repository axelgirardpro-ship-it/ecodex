import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getAdminContacts, getAdminWorkspaces, updateUserRole, updateWorkspacePlan, deleteUser } from '@/lib/adminApi'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { User, Mail, Shield, Building2, Edit, Trash2, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  user_id: string;
  workspace_id: string;
  role: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  company_plan?: string;
  created_at: string;
}

interface Company {
  id: string;
  name: string;
}

export const ContactsTable = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchCompanies = async () => {
    try {
      const data = await getAdminWorkspaces('all')
      setCompanies((data || []).map((w: { id: string; name: string })=>({ id: w.id, name: w.name })))
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const { items, total } = await getAdminContacts(selectedCompany === 'all' ? null : selectedCompany, page, pageSize)
      setContacts(items)
      setTotal(total)
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
    fetchContacts();
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [selectedCompany, page]);

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'pro': return 'default';
      case 'freemium': return 'outline';
      default: return 'outline';
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'destructive';
      case 'gestionnaire': return 'default';
      case 'lecteur': return 'secondary';
      default: return 'outline';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrateur';
      case 'gestionnaire': return 'Gestionnaire';
      case 'lecteur': return 'Lecteur';
      default: return role;
    }
  };

  const handlePlanChange = async (contact: Contact, newPlan: string) => {
    setUpdating(`plan-${contact.workspace_id}`);
    try {
      const data = await updateWorkspacePlan(contact.workspace_id, newPlan as 'freemium' | 'starter' | 'pro' | 'enterprise')
      toast({ title: "Plan du workspace mis à jour", description: `Plan changé vers ${newPlan}. ${data?.updatedUsers ?? 0} utilisateur(s) mis à jour.` })

      // Recharger les données
      await fetchContacts();
    } catch (error) {
      console.error('Error updating workspace plan:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la mise à jour du plan",
      });
    } finally {
      setUpdating(null);
    }
  };

  const handleRoleChange = async (contact: Contact, newRole: string) => {
    setUpdating(`role-${contact.user_id}`);
    try {
      await updateUserRole(contact.user_id, contact.workspace_id, newRole as 'admin' | 'gestionnaire' | 'lecteur')
      toast({ title: "Rôle mis à jour", description: `Rôle changé vers ${newRole}` })

      // Recharger les données
      await fetchContacts();
    } catch (error) {
      console.error('Error updating user role:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la mise à jour du rôle",
      });
    } finally {
      setUpdating(null);
    }
  };

  const deleteContact = async (userId: string, contactEmail: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le contact "${contactEmail}" ? Cette action est irréversible et supprimera toutes les données associées.`)) {
      return;
    }

    setDeleting(userId);
    try {
      await deleteUser(userId)

      toast({
        title: "Contact supprimé",
        description: `Le contact "${contactEmail}" a été supprimé avec succès.`,
      });

      fetchContacts();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Erreur lors de la suppression du contact",
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
            <User className="h-5 w-5" />
            Contacts par Entreprise
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
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
          <User className="h-5 w-5" />
          Contacts par Entreprise ({contacts.length})
          <Button
            size="sm"
            variant="outline"
            onClick={() => { fetchCompanies(); fetchContacts(); }}
            className="ml-auto"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Actualiser
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Pagination simple */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-muted-foreground">Page {page} • {total} résultats</div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Précédent</Button>
            <Button variant="outline" size="sm" onClick={()=>setPage(p=>p+1)} disabled={(page * pageSize) >= total}>Suivant</Button>
          </div>
        </div>
        <div className="mb-4">
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Filtrer par entreprise" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les entreprises</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contact</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Ajouté le</TableHead>
                <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {contact.first_name || contact.last_name ? 
                      `${contact.first_name} ${contact.last_name}`.trim() : 
                      'Nom non renseigné'
                    }
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {contact.email}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {contact.company_name}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={getPlanBadgeVariant(contact.company_plan || 'freemium')}>
                    {contact.company_plan}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    <Badge variant={getRoleBadgeVariant(contact.role)}>
                      {getRoleLabel(contact.role)}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  {new Date(contact.created_at).toLocaleDateString('fr-FR')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Select 
                      value={contact.company_plan || 'freemium'}
                      onValueChange={(newPlan) => handlePlanChange(contact, newPlan)}
                      disabled={updating === `plan-${contact.workspace_id}`}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="freemium">Freemium</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Select 
                      value={contact.role}
                      onValueChange={(newRole) => handleRoleChange(contact, newRole)}
                      disabled={updating === `role-${contact.user_id}`}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrateur</SelectItem>
                        <SelectItem value="gestionnaire">Gestionnaire</SelectItem>
                        <SelectItem value="lecteur">Lecteur</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteContact(contact.user_id, contact.email || '')}
                      disabled={deleting === contact.user_id || updating?.includes(contact.user_id)}
                    >
                      {deleting === contact.user_id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                    
                    {(updating === `plan-${contact.workspace_id}` || updating === `role-${contact.user_id}`) && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {contacts.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Aucun contact trouvé
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};