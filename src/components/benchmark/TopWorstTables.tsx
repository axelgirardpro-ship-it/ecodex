import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BenchmarkItemModal } from './BenchmarkItemModal';
import { formatEmissionFactor } from '@/lib/formatters/benchmarkFormatters';
import type { BenchmarkEmissionFactor } from '@/types/benchmark';

interface TopWorstTablesProps {
  top10: BenchmarkEmissionFactor[];
  worst10: BenchmarkEmissionFactor[];
}

export const TopWorstTables = ({ top10, worst10 }: TopWorstTablesProps) => {
  const { t } = useTranslation('benchmark');
  const [selectedItem, setSelectedItem] = useState<BenchmarkEmissionFactor | null>(null);

  const renderTable = (data: BenchmarkEmissionFactor[], isTop: boolean) => (
    <Card className={isTop ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}>
      <CardHeader>
        <CardTitle className={isTop ? 'text-green-600' : 'text-red-600'}>
          {t(isTop ? 'tables.top10.title' : 'tables.worst10.title')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{t('tables.top10.rank')}</TableHead>
                <TableHead>{t('tables.top10.name')}</TableHead>
                <TableHead className="text-right">{t('tables.top10.value')}</TableHead>
                <TableHead>{t('tables.top10.source')}</TableHead>
                <TableHead className="text-center">{t('tables.top10.year')}</TableHead>
                <TableHead className="text-center">{t('tables.top10.location')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((item, index) => (
                <TableRow
                  key={item.objectID}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setSelectedItem(item)}
                >
                  <TableCell className="font-medium">{index + 1}</TableCell>
                  <TableCell className="max-w-xs truncate" title={item.Nom_fr}>
                    {item.Nom_fr}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatEmissionFactor(item.FE)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {item.Source}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {item.Date || '-'}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {item.Localisation_fr || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-4 text-center italic">
          {t('tables.click_details')}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderTable(top10, true)}
        {renderTable(worst10, false)}
      </div>

      <BenchmarkItemModal
        item={selectedItem}
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </>
  );
};

