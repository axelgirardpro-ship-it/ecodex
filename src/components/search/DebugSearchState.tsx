import React from 'react';
import { useSearchBox, useStats, useInstantSearch } from 'react-instantsearch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const DebugSearchState: React.FC = () => {
  const { query } = useSearchBox();
  const { nbHits, processingTimeMS } = useStats();
  const { status } = useInstantSearch();
  
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
            <strong>Query:</strong> "{query}"
          </div>
          <div>
            <strong>Status:</strong> {status}
          </div>
          <div>
            <strong>Hits:</strong> {nbHits}
          </div>
          <div>
            <strong>Processing time:</strong> {processingTimeMS}ms
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DebugSearchState;
