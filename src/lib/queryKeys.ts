export const queryKeys = {
  quotas: {
    all: ['quotas'] as const,
    user: (userId: string) => [...queryKeys.quotas.all, userId] as const,
  },
  sources: {
    global: ['fe_sources', 'global'] as const,
    workspace: (workspaceId: string) => ['fe_sources', 'workspace', workspaceId] as const,
  },
  permissions: {
    supraAdmin: (userId: string) => ['is_supra_admin', userId] as const,
  },
  logos: {
    all: ['source-logos'] as const,
  },
};

