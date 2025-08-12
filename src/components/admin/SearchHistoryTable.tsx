import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Building2, User, Calendar, Hash } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface SearchRecord {
  id: string;
  user_id: string;
  workspace_id: string;
  search_query: string;
  search_filters: any;
  results_count: number;
  created_at: string;
  user_email?: string;
  company_name?: string;
}

interface Company {
  id: string;
  name: string;
}

export const SearchHistoryTable = () => {
  const [searches, setSearches] = useState<SearchRecord[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCompanies();
    fetchSearchHistory();
  }, []);

  useEffect(() => {
    fetchSearchHistory();
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

  const fetchSearchHistory = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('search_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (selectedCompany !== "all") {
        query = query.eq('workspace_id', selectedCompany);
      }

      const { data: searchData, error } = await query;
      if (error) throw error;

      // Get unique user IDs for batch email fetching
      const userIds = [...new Set((searchData || []).map(search => search.user_id))];
      
      // Fetch emails using admin edge function
      let userEmailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: emailData, error: emailError } = await supabase.functions.invoke('get-admin-users', {
          body: { userIds }
        });

        if (emailError) {
          console.error('Error fetching user emails:', emailError);
        } else {
          userEmailMap = emailData.users;
        }
      }

      // Get company details and combine with user emails
      const searchesWithDetails = await Promise.all(
        (searchData || []).map(async (search) => {
          const userEmail = userEmailMap[search.user_id] || 'Unknown';
          
          const { data: workspaceData } = await supabase
            .from('workspaces')
            .select('name')
            .eq('id', search.workspace_id)
            .single();

          return {
            ...search,
            user_email: userEmail,
            company_name: workspaceData?.name || 'Unknown'
          };
        })
      );

      setSearches(searchesWithDetails);
    } catch (error) {
      console.error('Error fetching search history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatSearchFilters = (filters: any) => {
    if (!filters || Object.keys(filters).length === 0) {
      return 'Aucun filtre';
    }
    
    const filterParts = [];
    if (filters.secteur) filterParts.push(`Secteur: ${filters.secteur}`);
    if (filters.categorie) filterParts.push(`Catégorie: ${filters.categorie}`);
    if (filters.source) filterParts.push(`Source: ${filters.source}`);
    if (filters.localisation) filterParts.push(`Localisation: ${filters.localisation}`);
    
    return filterParts.length > 0 ? filterParts.join(', ') : 'Filtres personnalisés';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Historique des Recherches
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
          <Search className="h-5 w-5" />
          Historique des Recherches ({searches.length})
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
              <TableHead>Requête</TableHead>
              <TableHead>Utilisateur</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead>Filtres</TableHead>
              <TableHead>Résultats</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {searches.map((search) => (
              <TableRow key={search.id}>
                <TableCell className="font-medium max-w-xs">
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{search.search_query}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{search.user_email}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {search.company_name}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  <span className="text-sm text-muted-foreground truncate">
                    {formatSearchFilters(search.search_filters)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    {search.results_count}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    {new Date(search.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {searches.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune recherche trouvée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};