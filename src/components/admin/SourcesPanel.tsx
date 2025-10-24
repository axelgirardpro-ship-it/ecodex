import React from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { EmissionFactorAccessManager } from '@/components/admin/EmissionFactorAccessManager'
import { SourceWorkspaceAssignments } from '@/components/admin/SourceWorkspaceAssignments'

export const SourcesPanel: React.FC = () => {
  const [tab, setTab] = React.useState<'access'|'assignments'>('access')

  return (
    <Tabs value={tab} onValueChange={(v)=>setTab(v as 'access' | 'assignments')} className="w-full">
      <TabsList>
        <TabsTrigger value="access">Accès aux sources</TabsTrigger>
        <TabsTrigger value="assignments">Assignations</TabsTrigger>
      </TabsList>
      <div className="mt-4" />
      {/* Monter un seul panneau à la fois pour éviter les fetchs concurrents */}
      {tab === 'access' && (
        <TabsContent value="access" asChild>
          <div>
            <EmissionFactorAccessManager />
          </div>
        </TabsContent>
      )}
      {tab === 'assignments' && (
        <TabsContent value="assignments" asChild>
          <div>
            <SourceWorkspaceAssignments />
          </div>
        </TabsContent>
      )}
    </Tabs>
  )
}


