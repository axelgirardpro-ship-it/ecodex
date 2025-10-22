import { AlertTriangle, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BenchmarkWarningsProps {
  warnings: string[];
}

export const BenchmarkWarnings = ({ warnings }: BenchmarkWarningsProps) => {
  if (warnings.length === 0) return null;

  return (
    <div className="space-y-2 mt-6">
      {warnings.map((warning, index) => {
        const isLargeSample = warning.includes('Échantillon important') || warning.includes('Large sample');
        const isMultipleSources = warning.includes('Sources multiples') || warning.includes('Multiple sources');

        return (
          <Alert
            key={`warning-${index}-${warning.substring(0, 20)}`}
            variant={isLargeSample ? 'default' : 'default'}
            className={
              isLargeSample
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                : 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            }
          >
            {isLargeSample ? (
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            ) : (
              <Info className="h-4 w-4 text-blue-600" />
            )}
            <AlertDescription
              className={isLargeSample ? 'text-amber-800' : 'text-blue-800'}
            >
              {warning}
            </AlertDescription>
          </Alert>
        );
      })}
    </div>
  );
};

