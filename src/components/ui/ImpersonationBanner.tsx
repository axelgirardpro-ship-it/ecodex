import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { useImpersonation } from "@/hooks/useImpersonation";
import { useToast } from "@/hooks/use-toast";
import { useTranslation, Trans } from "react-i18next";

export const ImpersonationBanner = () => {
  const { isImpersonating, impersonatedUser, stopImpersonation } = useImpersonation();
  const { toast } = useToast();
  const { t } = useTranslation('common', { keyPrefix: 'impersonation' });

  if (!isImpersonating || !impersonatedUser) return null;

  const handleStopImpersonation = async () => {
    const success = await stopImpersonation();
    if (success) {
      toast({
        title: (t as any)('toast.success_title'),
        description: (t as any)('toast.success_description'),
      });
      // Refresh the page to ensure clean state
      window.location.href = '/admin';
    } else {
      toast({
        variant: "destructive",
        title: (t as any)('toast.error_title'),
        description: (t as any)('toast.error_description'),
      });
    }
  };

  return (
    <Alert className="bg-orange-50 border-orange-200 mb-4">
      <Shield className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="text-orange-800 space-y-1">
          <strong>{(t as any)('banner.title')}</strong>
          <p>
            <Trans
              ns="common"
              i18nKey="impersonation.banner.description"
              components={{ 0: <strong />, 1: <strong /> }}
              values={{
                email: impersonatedUser.email,
                workspace: impersonatedUser.workspace_name,
              }}
            />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleStopImpersonation}
          className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100"
        >
          <LogOut className="h-4 w-4 mr-2" />
          {(t as any)('banner.button')}
        </Button>
      </AlertDescription>
    </Alert>
  );
};