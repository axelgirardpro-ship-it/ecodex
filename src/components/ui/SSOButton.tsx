import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface SSOButtonProps {
  provider: "google";
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  children: ReactNode;
  icon: ReactNode;
  className?: string;
}

export const SSOButton = ({ 
  provider, 
  onClick, 
  loading = false, 
  disabled = false, 
  children, 
  icon, 
  className = "" 
}: SSOButtonProps) => {
  const providerStyles = {
    google: "border-red-200 hover:border-red-300 hover:bg-red-50 text-gray-700"
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled || loading}
      className={`w-full transition-smooth ${providerStyles[provider]} ${className}`}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <span className="mr-2">{icon}</span>
      )}
      {children}
    </Button>
  );
};