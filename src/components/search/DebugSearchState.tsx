import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const DebugSearchState: React.FC = () => {
  if (!import.meta.env.DEV) {
    return null; // Ne s'affiche qu'en développement
  }

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="text-sm">🔍 Debug - État de la recherche</CardTitle>
      </CardHeader>
      <CardContent className="text-xs">
        <div className="space-y-2">
          <div>
            <strong>Recherches récentes:</strong> désactivées
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugSearchState;
