-- Fix RLS policies pour benchmarks
-- Les policies précédentes ne fonctionnaient pas correctement

-- Supprimer les anciennes policies
DROP POLICY IF EXISTS "Workspace members can view benchmarks" ON public.benchmarks;
DROP POLICY IF EXISTS "Users can create benchmarks" ON public.benchmarks;
DROP POLICY IF EXISTS "Workspace members can update benchmarks" ON public.benchmarks;
DROP POLICY IF EXISTS "Workspace members can delete benchmarks" ON public.benchmarks;

-- Policy SELECT : Utilisateur doit appartenir au workspace du benchmark
CREATE POLICY "Workspace members can view benchmarks"
  ON public.benchmarks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.user_id = auth.uid() 
      AND users.workspace_id = benchmarks.workspace_id
    )
  );

-- Policy INSERT : Utilisateur doit appartenir au workspace
CREATE POLICY "Users can create benchmarks"
  ON public.benchmarks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.user_id = auth.uid() 
      AND users.workspace_id = benchmarks.workspace_id
    )
  );

-- Policy UPDATE : Utilisateur doit appartenir au workspace (pour soft delete)
CREATE POLICY "Workspace members can update benchmarks"
  ON public.benchmarks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.user_id = auth.uid() 
      AND users.workspace_id = benchmarks.workspace_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.user_id = auth.uid() 
      AND users.workspace_id = benchmarks.workspace_id
    )
  );

-- Policy DELETE : Utilisateur doit appartenir au workspace (au cas où hard delete)
CREATE POLICY "Workspace members can delete benchmarks"
  ON public.benchmarks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.user_id = auth.uid() 
      AND users.workspace_id = benchmarks.workspace_id
    )
  );

