import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Building2, Users, Calendar, Edit, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { deleteWorkspace, getAdminWorkspaces, PlanFilter, updateWorkspaceTier, getPlanTiers } from '@/lib/adminApi'
import type { PlanTier, WorkspaceWithTier } from '@/types/plan-tiers'

type WorkspaceRow = WorkspaceWithTier

export const WorkspacesTable = () => {
  const [filter, setFilter] = useState<PlanFilter>('paid')
  const [rows, setRows] = useState<WorkspaceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPlanId, setEditingPlanId] = useState<string|null>(null)
  const [deletingId, setDeletingId] = useState<string|null>(null)
  const [availableTiers, setAvailableTiers] = useState<PlanTier[]>([])
  const { toast } = useToast()

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const [data, tiers] = await Promise.all([
          getAdminWorkspaces(filter),
          getPlanTiers()
        ])
        console.log('Workspaces loaded:', data)
        console.log('Tiers loaded:', tiers)
        setRows(data)
        setAvailableTiers(tiers)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    })()
  }, [filter])

  const badge = (plan: string) => plan === 'pro' ? 'default' : 'outline'

  const onUpdateTier = async (id: string, tierCode: string) => {
    try {
      await updateWorkspaceTier(id, tierCode)
      toast({ title: 'Tier mis à jour', description: 'Le niveau du plan a été modifié avec succès' })
      const data = await getAdminWorkspaces(filter, { force: true })
      setRows(data)
      setEditingPlanId(null)
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(errorMessage)
      // Gérer spécifiquement l'erreur de limite d'utilisateurs
      if (e.message?.includes('User limit exceeded') || e.message?.includes('user limit')) {
        toast({ 
          variant: 'destructive', 
          title: 'Limite d\'utilisateurs dépassée', 
          description: e.message
        })
      } else {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Mise à jour du tier impossible' })
      }
    }
  }

  const onDelete = async (id: string, name: string) => {
    if (!confirm(`Supprimer l'entreprise "${name}" ?`)) return
    setDeletingId(id)
    try {
      await deleteWorkspace(id)
      toast({ title: 'Entreprise supprimée', description: name })
      const data = await getAdminWorkspaces(filter, { force: true })
      setRows(data)
    } catch (e) {
      console.error(e)
      toast({ variant: 'destructive', title: 'Erreur', description: 'Suppression impossible' })
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Entreprises ({rows.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filter} onValueChange={(v) => setFilter(v as PlanFilter)}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Filtre" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Payantes</SelectItem>
                <SelectItem value="freemium">Freemium</SelectItem>
                <SelectItem value="all">Toutes</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">{[...Array(5)].map((_,i)=>(<Skeleton key={i} className="h-12 w-full" />))}</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entreprise</TableHead>
                <TableHead>Propriétaire</TableHead>
                <TableHead>Plan & Tier</TableHead>
                <TableHead>Utilisateurs</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(w => (
                <TableRow key={w.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div>{w.name}</div>
                        <div className="text-xs text-muted-foreground">ID: {w.id.slice(0,8)}...</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{w.owner_email}</TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={badge(w.plan_type)} className="w-fit">{w.plan_type}</Badge>
                      {w.tier_info ? (
                        <span className="text-xs text-muted-foreground">
                          {w.tier_info.display_name_fr}
                        </span>
                      ) : w.plan_tier ? (
                        <span className="text-xs text-muted-foreground">
                          {w.plan_tier}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Non défini
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {w.tier_info ? (
                        <span className={((w.user_count || 0) + (w.pending_invitations || 0)) > w.tier_info.max_users ? 'text-destructive font-medium' : ''}>
                          {(w.user_count || 0) + (w.pending_invitations || 0)} / {w.tier_info.max_users === 999999 ? '∞' : w.tier_info.max_users}
                        </span>
                      ) : (
                        <span>
                          {(w.user_count || 0) + (w.pending_invitations || 0)} / -
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" />{new Date(w.created_at).toLocaleDateString('fr-FR')}</div></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {editingPlanId === w.id ? (
                        <>
                          <Select value={w.plan_tier || ''} onValueChange={(v)=>onUpdateTier(w.id, v)}>
                            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {availableTiers.map(tier => (
                                <SelectItem key={tier.tier_code} value={tier.tier_code}>
                                  {tier.display_name_fr}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="sm" onClick={()=>setEditingPlanId(null)}>Annuler</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={()=>setEditingPlanId(w.id)}><Edit className="h-4 w-4 mr-2"/>Modifier</Button>
                          <Button variant="destructive" size="sm" onClick={()=>onDelete(w.id, w.name)} disabled={deletingId===w.id}>{deletingId===w.id? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>:<Trash2 className="h-4 w-4"/>}</Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length===0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Aucune entreprise trouvée</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}


