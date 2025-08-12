import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useToast } from "@/hooks/use-toast";

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();
  const { toast } = useToast();

  if (!isImpersonating || !impersonatedUser) return null;

  const handleStopImpersonation = async () => {
    const success = await stopImpersonation();
    if (success) {
      toast({
        title: "Impersonation terminée",
        description: "Vous êtes de nouveau connecté avec votre compte admin",
      });
      // Refresh the page to ensure clean state
      window.location.href = '/admin';
    } else {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de terminer l'impersonation",
      });
    }
  };

  return (
    <Alert className="bg-orange-50 border-orange-200 mb-4">
      <Shield className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="text-orange-800">
          <strong>Mode Impersonation:</strong> Vous êtes connecté en tant que{" "}
          <strong>{impersonatedUser.email}</strong> dans le workspace{" "}
          <strong>{impersonatedUser.workspace_name}</strong>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStopImpersonation}
          className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Retour admin
        </Button>
      </AlertDescription>
    </Alert>
  );
};