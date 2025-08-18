import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Users, AlertTriangle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface RepairedUser {
  user_id: string;
  email: string;
  workspace_id: string;
  workspace_name: string;
}

interface RepairResult {
  success: boolean;
  message: string;
  orphanUsersFound: number;
  usersRepaired: number;
  repairedUsers: RepairedUser[];
}

export const OrphanUsersRepair = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [lastResult, setLastResult] = useState<RepairResult | null>(null);
  const { toast } = useToast();

  const handleRepair = async () => {
    setIsLoading(true);
    setLastResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erreur d'authentification",
          description: "Vous devez être connecté pour effectuer cette action.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/fix-orphan-users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setLastResult(result);
        toast({
          title: "Réparation terminée",
          description: result.message,
        });
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Une erreur est survenue lors de la réparation.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error during repair:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue est survenue.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <CardTitle>Réparation des utilisateurs orphelins</CardTitle>
          </div>
          <CardDescription>
            Répare les utilisateurs qui existent dans auth.users mais pas dans public.users.
            Cette situation peut survenir si la fonction handle_new_user a échoué lors de l'inscription.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Attention :</strong> Cette opération va créer des workspaces et des profils utilisateur 
              pour tous les utilisateurs orphelins trouvés. Utilisez cette fonction uniquement si vous 
              identifiez des incohérences dans les données.
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleRepair}
            disabled={isLoading}
            className="w-full"
            variant="destructive"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Réparation en cours...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                Réparer les utilisateurs orphelins
              </>
            )}
          </Button>

          {lastResult && (
            <div className="space-y-3">
              <Alert className={lastResult.success ? "border-green-200 bg-green-50" : "border-destructive"}>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Résultat :</strong> {lastResult.message}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-muted-foreground">
                    {lastResult.orphanUsersFound}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Utilisateurs orphelins trouvés
                  </div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-700">
                    {lastResult.usersRepaired}
                  </div>
                  <div className="text-sm text-green-700">
                    Utilisateurs réparés
                  </div>
                </div>
              </div>

              {lastResult.repairedUsers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Utilisateurs réparés :</h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {lastResult.repairedUsers.map((user) => (
                      <div key={user.user_id} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                        <div>
                          <div className="font-medium">{user.email}</div>
                          <div className="text-muted-foreground">{user.workspace_name}</div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {user.workspace_id.slice(0, 8)}...
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
