import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Crown, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface PremiumBlurProps {
  isBlurred?: boolean;
  children: React.ReactNode;
  className?: string;
  showUpgradeButton?: boolean;
  showBadge?: boolean;
}

export const PremiumBlur = ({ 
  isBlurred = false, 
  children, 
  className,
  showUpgradeButton = false,
  showBadge = true
}: PremiumBlurProps) => {
  const { currentWorkspace } = useWorkspace();

  // Le plan du workspace ne doit pas bypass le blur premium
  if (!isBlurred) {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      <div className="filter blur-sm pointer-events-none select-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center bg-background/80">
        <div className="text-center space-y-2">
          {showBadge && (
            <Badge variant="default" className="bg-[#4ABEA1] text-white border-0">
              <Crown className="w-3 h-3 mr-1" />
              Base payante
            </Badge>
          )}
          {showUpgradeButton && (
            <Button 
              size="sm" 
              onClick={() => window.location.href = '/settings'}
              className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 hover:from-yellow-500 hover:to-orange-600"
            >
              <Unlock className="w-3 h-3 mr-1" />
              Débloquer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};