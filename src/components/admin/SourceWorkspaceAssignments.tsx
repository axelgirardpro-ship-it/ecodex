import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { assignFeSourceToWorkspace, unassignFeSourceFromWorkspace, syncWorkspaceAssignments, getAdminWorkspaces } from '@/lib/adminApi'
import { useFeSources } from '@/contexts/FeSourcesContext'
import { useWorkspaceAssignmentsRealtime } from "@/hooks/useOptimizedRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Database, RefreshCw, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Workspace {
  id: string;
  name: string;
  plan_type: string;
}

interface SourceOption {
  source_name: string;
  access_level: string;
}

export const SourceWorkspaceAssignments = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const { sources: ctxSources, refresh: refreshSources } = useFeSources()
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [assignedSet, setAssignedSet] = useState<Set<string>>(new Set());
  const [rowBusy, setRowBusy] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const getSourceBadgeVariant = (accessLevel: string) => accessLevel === 'premium' ? 'default' : 'secondary';

  const fetchWorkspaces = useCallback(async () => {
    const rows = await getAdminWorkspaces('all')
    const ws: Workspace[] = (rows || []).map((w: any)=>({ id: w.id, name: w.name, plan_type: w.plan_type }))
    setWorkspaces(ws)
    if (!selectedWorkspaceId && ws.length) setSelectedWorkspaceId(ws[0].id)
  }, [selectedWorkspaceId])

  const fetchAssignments = useCallback(async (workspaceId: string) => {
    if (!workspaceId) { setAssignedSet(new Set()); return; }
    const { data, error } = await supabase
      .from('fe_source_workspace_assignments')
      .select('source_name')
      .eq('workspace_id', workspaceId)
    if (error) throw error
    setAssignedSet(new Set((data || []).map((r: any)=>r.source_name)))
  }, [])

  // Callback optimisé pour les mises à jour Realtime
  const handleAssignmentUpdate = useCallback(() => {
    if (selectedWorkspaceId) {
      fetchAssignments(selectedWorkspaceId).catch(() => {});
    }
  }, [selectedWorkspaceId, fetchAssignments]);

  // Subscription Realtime optimisée
  useWorkspaceAssignmentsRealtime(selectedWorkspaceId, handleAssignmentUpdate);

  useEffect(() => { setSources((ctxSources || []) as any) }, [ctxSources])

  useEffect(() => {
    (async () => {
      try { setLoading(true); await fetchWorkspaces() } catch (e) {
        console.error(e); toast({ title: 'Erreur', description: 'Chargement workspaces impossible', variant: 'destructive' })
      } finally { setLoading(false) }
    })()
  }, [fetchWorkspaces, toast])

  useEffect(() => {
    (async () => {
      try { if (selectedWorkspaceId) { setLoading(true); await fetchAssignments(selectedWorkspaceId) } }
      catch (e) { console.error(e) }
      finally { setLoading(false) }
    })()
  }, [selectedWorkspaceId, fetchAssignments])



  const toggle = useCallback(async (sourceName: string, enable: boolean) => {
    if (!selectedWorkspaceId) return
    setRowBusy(prev => ({ ...prev, [sourceName]: true }))
    try {
      if (enable) {
        await assignFeSourceToWorkspace(sourceName, selectedWorkspaceId)
        setAssignedSet(prev => new Set(prev).add(sourceName))
      } else {
        await unassignFeSourceFromWorkspace(sourceName, selectedWorkspaceId)
        setAssignedSet(prev => { const s = new Set(prev); s.delete(sourceName); return s })
      }
    } catch (e) {
      console.error(e)
      toast({ title: 'Erreur', description: "Mise à jour impossible", variant: 'destructive' })
    } finally {
      setRowBusy(prev => ({ ...prev, [sourceName]: false }))
    }
  }, [selectedWorkspaceId, toast])

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
          <div className="space-y-3">{[...Array(5)].map((_,i)=>(<Skeleton key={i} className="h-12 w-full" />))}</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Assignations Sources ↔ Workspaces
          <Button size="sm" variant="outline" onClick={()=>{ Promise.all([refreshSources()]).finally(()=> selectedWorkspaceId && fetchAssignments(selectedWorkspaceId)) }} className="ml-auto">
            <RefreshCw className="h-3 w-3 mr-1" />
            Actualiser
          </Button>
          <Button
            size="sm"
            variant="default"
            className="ml-2"
            onClick={async ()=>{
              if (!selectedWorkspaceId) return
              try {
                const premiumSources = sources.filter(s=> s.access_level==='premium').map(s=>s.source_name)
                const standardSources = sources.filter(s=> s.access_level==='standard').map(s=>s.source_name)
                const assignedPremium = premiumSources.filter(s=> assignedSet.has(s))
                const unassignedPremium = premiumSources.filter(s=> !assignedSet.has(s))
                const assigned = [...standardSources, ...assignedPremium]
                const unassigned = unassignedPremium
                await syncWorkspaceAssignments(selectedWorkspaceId, assigned, unassigned)
                toast({ title: 'Synchronisation réussie', description: `Assignés: ${assigned.length} • Désassignés: ${unassigned.length}` })
                await fetchAssignments(selectedWorkspaceId)
              } catch (e:any) {
                console.error(e)
                toast({ title: 'Erreur', description: e?.message || 'Synchronisation impossible', variant: 'destructive' })
              }
            }}
          >
            Resynchroniser
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-4">
            <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
              <SelectTrigger className="w-96"><SelectValue placeholder="Sélectionner un workspace" /></SelectTrigger>
              <SelectContent>
                {workspaces.map(ws=> (<SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source</TableHead>
              <TableHead>Access level</TableHead>
              <TableHead>Activer</TableHead>
              <TableHead>Désactiver</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sources.map((s)=>{
              const enabled = (s.access_level === 'standard') || assignedSet.has(s.source_name)
              const busy = !!rowBusy[s.source_name]
              const premium = s.access_level === 'premium'
              return (
                <TableRow key={s.source_name}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{s.source_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={getSourceBadgeVariant(s.access_level)}>{s.access_level}</Badge>
                  </TableCell>
                  <TableCell>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <Checkbox 
                        checked={enabled}
                        onCheckedChange={() => premium && toggle(s.source_name, true)}
                        disabled={!selectedWorkspaceId || !premium}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                      <Checkbox 
                        checked={!enabled}
                        onCheckedChange={() => premium && toggle(s.source_name, false)}
                        disabled={!selectedWorkspaceId || !premium}
                      />
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
            {sources.length===0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">Aucune source trouvée</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}