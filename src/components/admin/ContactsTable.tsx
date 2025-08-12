import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { User, Mail, Shield, Building2, Edit, Trash2, UserCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useImpersonation } from "@/hooks/useImpersonation";

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
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const { toast } = useToast();
  const { startImpersonation } = useImpersonation();

  useEffect(() => {
    fetchCompanies();
    fetchContacts();
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [selectedCompany]);

  const fetchCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      
      console.log('ContactsTable: Fetching contacts with workspaceId:', selectedCompany);
      
      // Use edge function to get contacts with admin privileges
      const { data, error } = await supabase.functions.invoke('get-admin-contacts', {
        body: { workspaceId: selectedCompany }
      });

      if (error) throw error;

      console.log('ContactsTable: Raw response:', data);
      console.log('ContactsTable: Found contacts count:', data?.data?.length || 0);
      
      if (data?.data) {
        setContacts(data.data);
        console.log('ContactsTable: Setting contacts:', data.data.map((c: Contact) => ({ 
          email: c.email, 
          company: c.company_name, 
          plan: c.company_plan 
        })));
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPlanBadgeVariant = (plan: string) => {
    switch (plan) {
      case 'premium': return 'default';
      case 'standard': return 'secondary';
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
      const { data, error } = await supabase.functions.invoke('update-user-plan-role', {
        body: { 
          action: 'update_workspace_plan', 
          workspaceId: contact.workspace_id, 
          newPlan 
        }
      });

      if (error) throw error;

      toast({
        title: "Plan du workspace mis à jour",
        description: `Plan changé vers ${newPlan}. ${data.updatedUsers} utilisateur(s) mis à jour.`,
      });

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
      const { data, error } = await supabase.functions.invoke('update-user-plan-role', {
        body: { 
          action: 'update_user_role', 
          userId: contact.user_id,
          workspaceId: contact.workspace_id,
          newRole 
        }
      });

      if (error) throw error;

      toast({
        title: "Rôle mis à jour",
        description: `Rôle changé vers ${newRole}`,
      });

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

  const handleImpersonation = async (contact: Contact) => {
    setImpersonating(contact.user_id);
    try {
      const success = await startImpersonation(
        contact.user_id,
        contact.email || '',
        contact.workspace_id,
        contact.company_name || ''
      );

      if (success) {
        toast({
          title: "Impersonation démarrée",
          description: `Vous êtes maintenant connecté en tant que ${contact.email}`,
        });
        
        // Redirect to main app
        window.location.href = '/';
      } else {
        throw new Error('Failed to start impersonation');
      }
    } catch (error) {
      console.error('Error starting impersonation:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de démarrer l'impersonation",
      });
    } finally {
      setImpersonating(null);
    }
  };

  const deleteContact = async (userId: string, contactEmail: string) => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le contact "${contactEmail}" ? Cette action est irréversible et supprimera toutes les données associées.`)) {
      return;
    }

    setDeleting(userId);
    try {
      const { error } = await supabase.functions.invoke('delete-admin-entities', {
        body: { type: 'user', id: userId }
      });

      if (error) throw error;

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
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleImpersonation(contact)}
                      disabled={impersonating === contact.user_id || updating?.includes(contact.user_id)}
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700"
                    >
                      {impersonating === contact.user_id ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700"></div>
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </Button>
                    
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
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
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