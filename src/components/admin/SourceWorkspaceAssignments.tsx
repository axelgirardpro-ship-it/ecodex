import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Database, Plus, RefreshCw, CheckCircle, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface SourceAssignment {
  id: string;
  source_name: string;
  workspace_id: string;
  workspace_name: string;
  assigned_by: string;
  created_at: string;
}

interface Workspace {
  id: string;
  name: string;
  plan_type: string;
}

interface SourceOption {
  source_name: string;
  access_level: string;
}

interface ActionState {
  [key: string]: {
    loading: boolean;
    success: boolean;
  };
}

export const SourceWorkspaceAssignments = () => {
  const [assignments, setAssignments] = useState<SourceAssignment[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionStates, setActionStates] = useState<ActionState>({});
  const [newAssignment, setNewAssignment] = useState({
    source_name: '',
    workspace_id: ''
  });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch assignments with workspace names
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('fe_source_workspace_assignments')
        .select(`
          id,
          source_name,
          workspace_id,
          assigned_by,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Fetch workspace names separately
      const workspaceIds = assignmentsData?.map(a => a.workspace_id) || [];
      const { data: workspaceNamesData, error: workspaceNamesError } = await supabase
        .from('workspaces')
        .select('id, name')
        .in('id', workspaceIds);

      if (workspaceNamesError) throw workspaceNamesError;

      // Create workspace name lookup
      const workspaceNameMap = new Map(
        workspaceNamesData?.map(w => [w.id, w.name]) || []
      );

      // Transform assignments data
      const transformedAssignments: SourceAssignment[] = assignmentsData?.map(assignment => ({
        id: assignment.id,
        source_name: assignment.source_name,
        workspace_id: assignment.workspace_id,
        workspace_name: workspaceNameMap.get(assignment.workspace_id) || 'Unknown',
        assigned_by: assignment.assigned_by,
        created_at: assignment.created_at
      })) || [];

      setAssignments(transformedAssignments);

      // Fetch workspaces for dropdown using admin function
      const { data: workspacesResponse, error: workspacesError } = await supabase.functions.invoke('get-admin-workspaces', {
        body: { planFilter: 'all' }
      });

      if (workspacesError) throw workspacesError;

      // Transform workspaces data
      const workspacesData = workspacesResponse?.data?.map((ws: any) => ({
        id: ws.id,
        name: ws.name,
        plan_type: ws.plan_type
      })) || [];

      setWorkspaces(workspacesData);

      // Fetch available sources
      const { data: sourcesData, error: sourcesError } = await supabase
        .from('fe_sources')
        .select('source_name, access_level')
        .eq('is_global', true)
        .order('source_name');

      if (sourcesError) throw sourcesError;
      setSources(sourcesData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les données",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createAssignment = useCallback(async () => {
    if (!newAssignment.source_name || !newAssignment.workspace_id) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une source et un workspace",
        variant: "destructive",
      });
      return;
    }

    const actionKey = `create-${newAssignment.source_name}-${newAssignment.workspace_id}`;
    
    setActionStates(prev => ({
      ...prev,
      [actionKey]: { loading: true, success: false }
    }));

    try {
      const { error } = await supabase
        .from('fe_source_workspace_assignments')
        .insert({
          source_name: newAssignment.source_name,
          workspace_id: newAssignment.workspace_id,
          assigned_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      setActionStates(prev => ({
        ...prev,
        [actionKey]: { loading: false, success: true }
      }));

      // Reset form
      setNewAssignment({ source_name: '', workspace_id: '' });
      
      // Refresh data
      await fetchData();

      toast({
        title: "Succès",
        description: "Assignation créée avec succès",
      });

      // Clear success state after 3 seconds
      setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [actionKey]: { loading: false, success: false }
        }));
      }, 3000);

    } catch (error) {
      console.error('Error creating assignment:', error);
      
      setActionStates(prev => ({
        ...prev,
        [actionKey]: { loading: false, success: false }
      }));

      toast({
        title: "Erreur",
        description: "Impossible de créer l'assignation",
        variant: "destructive",
      });
    }
  }, [newAssignment, fetchData, toast]);

  const deleteAssignment = useCallback(async (assignmentId: string) => {
    const actionKey = `delete-${assignmentId}`;
    
    setActionStates(prev => ({
      ...prev,
      [actionKey]: { loading: true, success: false }
    }));

    try {
      const { error } = await supabase
        .from('fe_source_workspace_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      setActionStates(prev => ({
        ...prev,
        [actionKey]: { loading: false, success: true }
      }));

      // Refresh data
      await fetchData();

      toast({
        title: "Succès",
        description: "Assignation supprimée avec succès",
      });

      // Clear success state after 3 seconds
      setTimeout(() => {
        setActionStates(prev => ({
          ...prev,
          [actionKey]: { loading: false, success: false }
        }));
      }, 3000);

    } catch (error) {
      console.error('Error deleting assignment:', error);
      
      setActionStates(prev => ({
        ...prev,
        [actionKey]: { loading: false, success: false }
      }));

      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'assignation",
        variant: "destructive",
      });
    }
  }, [fetchData, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getSourceBadgeVariant = (accessLevel: string) => {
    return accessLevel === 'premium' ? 'default' : 'secondary';
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
            Assignations Sources ↔ Workspaces
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

  const createActionKey = `create-${newAssignment.source_name}-${newAssignment.workspace_id}`;
  const createActionState = actionStates[createActionKey];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Assignations Sources ↔ Workspaces
          <Button
            size="sm"
            variant="outline"
            onClick={fetchData}
            className="ml-auto"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Actualiser
          </Button>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Assignez des sources spécifiques à des workspaces pour un accès personnalisé aux facteurs d'émission.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* New Assignment Form */}
        <div className="flex gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <Select
              value={newAssignment.source_name}
              onValueChange={(value) => setNewAssignment(prev => ({ ...prev, source_name: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une source" />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.source_name} value={source.source_name}>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4" />
                      <span>{source.source_name}</span>
                      <Badge variant={getSourceBadgeVariant(source.access_level)} className="ml-auto">
                        {source.access_level}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1">
            <Select
              value={newAssignment.workspace_id}
              onValueChange={(value) => setNewAssignment(prev => ({ ...prev, workspace_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un workspace" />
              </SelectTrigger>
              <SelectContent>
                {workspaces.map((workspace) => (
                  <SelectItem key={workspace.id} value={workspace.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{workspace.name}</span>
                      <Badge variant={getPlanBadgeVariant(workspace.plan_type)} className="ml-auto">
                        {workspace.plan_type}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={createAssignment}
            disabled={createActionState?.loading || !newAssignment.source_name || !newAssignment.workspace_id}
          >
            {createActionState?.loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : createActionState?.success ? (
              <CheckCircle className="h-4 w-4 mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {createActionState?.loading ? 'Création...' : createActionState?.success ? 'Créé' : 'Assigner'}
          </Button>
        </div>

        {/* Assignments Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Workspace</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Assigné le</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((assignment) => {
              const deleteActionKey = `delete-${assignment.id}`;
              const deleteActionState = actionStates[deleteActionKey];
              const workspace = workspaces.find(w => w.id === assignment.workspace_id);
              const source = sources.find(s => s.source_name === assignment.source_name);
              
              return (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{assignment.source_name}</span>
                      {source && (
                        <Badge variant={getSourceBadgeVariant(source.access_level)}>
                          {source.access_level}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{assignment.workspace_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {workspace && (
                      <Badge variant={getPlanBadgeVariant(workspace.plan_type)}>
                        {workspace.plan_type}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {new Date(assignment.created_at).toLocaleDateString('fr-FR')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={deleteActionState?.success ? "default" : "outline"}
                      onClick={() => deleteAssignment(assignment.id)}
                      disabled={deleteActionState?.loading}
                    >
                      {deleteActionState?.loading ? (
                        <>
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Suppression...
                        </>
                      ) : deleteActionState?.success ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Supprimé
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-3 w-3 mr-1" />
                          Supprimer
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {assignments.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune assignation trouvée
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};