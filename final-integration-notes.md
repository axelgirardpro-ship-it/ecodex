# 🎯 Intégrations finales nécessaires

## 1. App.tsx - Ajouter la route AuthCallback
```tsx
// Ajouter l'import
import AuthCallback from "./pages/AuthCallback";

// Ajouter la route après la ligne 87
<Route path="/auth/callback" element={<AuthCallback />} />
```

## 2. Login.tsx - Intégrer PasswordReset
```tsx
// Ajouter l'import
import { PasswordReset } from "@/components/auth/PasswordReset";

// Ajouter l'état
const [showPasswordReset, setShowPasswordReset] = useState(false);

// Condition dans le render
if (showPasswordReset) {
  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <PasswordReset onBack={() => setShowPasswordReset(false)} />
    </div>
  );
}

// Ajouter le lien après le bouton de connexion (ligne 200)
<div className="text-center mt-2">
  <button
    type="button"
    onClick={() => setShowPasswordReset(true)}
    className="text-sm text-blue-600 hover:underline"
  >
    Mot de passe oublié ?
  </button>
</div>
```

## 3. Settings.tsx - Ajouter WorkspaceUsersManager
```tsx
// Ajouter l'import
import { WorkspaceUsersManager } from "@/components/workspace/WorkspaceUsersManager";

// Ajouter après la Card "Workspace" (ligne 185)
<WorkspaceUsersManager />
```

## 4. Configuration Supabase Dashboard
- Site URL: https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com
- Redirect URLs:
  - https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com/auth/callback
  - https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com/**

## 5. Suppression des anciens adminApi
```tsx
// Dans src/lib/adminApi.ts, simplifier ou supprimer les fonctions complexes
// Remplacer par les appels directs à supabase dans les composants
```

## 🎉 Résultat final
- **Système d'invitation native** avec `supabase.auth.admin.inviteUserByEmail()`
- **Reset de mot de passe** avec `supabase.auth.resetPasswordForEmail()`
- **Gestion des utilisateurs** avec `supabase.rpc('get_workspace_users_with_roles')`
- **Plus d'Edge Functions complexes** - tout native !
- **Plus d'erreur 1101** - redirections gérées nativement
