import { Button } from "@/components/ui/button";
import { Crown, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export const UpgradeButton = () => {
  const { toast } = useToast();

  const handleUpgrade = () => {
    // Rediriger vers la page paramètres
    window.location.href = '/settings';
  };

  // Don't show for pro users - simplified logic for now
  return null;

};