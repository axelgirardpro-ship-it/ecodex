import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { BenchmarkData } from '@/types/benchmark';

interface BenchmarkPDFDocumentProps {
  data: BenchmarkData;
  title: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 10,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 2,
    borderBottomColor: '#000',
    paddingBottom: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginTop: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000',
  },
  statsGrid: {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: '48%',
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
    marginBottom: 10,
  },
  statLabel: {
    fontSize: 9,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  table: {
    display: 'flex',
    width: '100%',
    marginTop: 10,
  },
  tableRow: {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: 1,
    borderBottomColor: '#e0e0e0',
    paddingVertical: 5,
  },
  tableHeader: {
    backgroundColor: '#f0f0f0',
    fontWeight: 'bold',
  },
  tableCol1: {
    width: '10%',
  },
  tableCol2: {
    width: '40%',
  },
  tableCol3: {
    width: '20%',
  },
  tableCol4: {
    width: '20%',
  },
  tableCol5: {
    width: '10%',
  },
  metadata: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#f9f9f9',
    borderRadius: 5,
  },
  metadataRow: {
    display: 'flex',
    flexDirection: 'row',
    marginBottom: 5,
  },
  metadataLabel: {
    width: '30%',
    fontWeight: 'bold',
  },
  metadataValue: {
    width: '70%',
  },
  warning: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 5,
    borderLeft: 3,
    borderLeftColor: '#ffc107',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#999',
    fontSize: 8,
    borderTop: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 10,
  },
});

export const BenchmarkPDFDocument = ({ data, title }: BenchmarkPDFDocumentProps) => {
  const today = new Date().toLocaleDateString('fr-FR');

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Généré le {today}</Text>
        </View>

        {/* Metadata */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informations</Text>
          <View style={styles.metadata}>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Unité :</Text>
              <Text style={styles.metadataValue}>{data.metadata.unit}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Périmètre :</Text>
              <Text style={styles.metadataValue}>{data.metadata.scope}</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Taille échantillon :</Text>
              <Text style={styles.metadataValue}>{data.statistics.sampleSize} FE</Text>
            </View>
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Sources :</Text>
              <Text style={styles.metadataValue}>
                {data.metadata.sources.join(', ')}
              </Text>
            </View>
            {data.metadata.dateRange && data.metadata.dateRange.min && data.metadata.dateRange.max && (
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Période :</Text>
                <Text style={styles.metadataValue}>
                  {data.metadata.dateRange.min} - {data.metadata.dateRange.max}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Warnings */}
        {data.warnings && data.warnings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Avertissements</Text>
            {data.warnings.map((warning, index) => (
              <View key={index} style={styles.warning}>
                <Text>{warning}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Statistics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistiques</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Médiane</Text>
              <Text style={styles.statValue}>{data.statistics.median.toFixed(4)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Moyenne</Text>
              <Text style={styles.statValue}>{data.statistics.mean.toFixed(4)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Q1 (1er Quartile)</Text>
              <Text style={styles.statValue}>{data.statistics.q1.toFixed(4)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Q3 (3ème Quartile)</Text>
              <Text style={styles.statValue}>{data.statistics.q3.toFixed(4)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Minimum</Text>
              <Text style={styles.statValue}>
                {data.statistics.min != null ? data.statistics.min.toFixed(4) : 'N/A'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Maximum</Text>
              <Text style={styles.statValue}>
                {data.statistics.max != null ? data.statistics.max.toFixed(4) : 'N/A'}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Écart-type</Text>
              <Text style={styles.statValue}>
                {data.statistics.standardDeviation.toFixed(4)}
              </Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>IQR</Text>
              <Text style={styles.statValue}>{data.statistics.iqr.toFixed(4)}</Text>
            </View>
          </View>
        </View>

        {/* Top 10 */}
        <View style={styles.section} break>
          <Text style={styles.sectionTitle}>Top 10 - Valeurs les plus faibles</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCol1}>#</Text>
              <Text style={styles.tableCol2}>Nom</Text>
              <Text style={styles.tableCol3}>Valeur</Text>
              <Text style={styles.tableCol4}>Source</Text>
              <Text style={styles.tableCol5}>Année</Text>
            </View>
            {data.top10.map((item, index) => (
              <View key={item.objectID} style={styles.tableRow}>
                <Text style={styles.tableCol1}>{index + 1}</Text>
                <Text style={styles.tableCol2}>{item.Nom_fr}</Text>
                <Text style={styles.tableCol3}>{item.FE.toFixed(4)}</Text>
                <Text style={styles.tableCol4}>{item.Source}</Text>
                <Text style={styles.tableCol5}>{item.Date || '-'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Worst 10 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worst 10 - Valeurs les plus élevées</Text>
          <View style={styles.table}>
            <View style={[styles.tableRow, styles.tableHeader]}>
              <Text style={styles.tableCol1}>#</Text>
              <Text style={styles.tableCol2}>Nom</Text>
              <Text style={styles.tableCol3}>Valeur</Text>
              <Text style={styles.tableCol4}>Source</Text>
              <Text style={styles.tableCol5}>Année</Text>
            </View>
            {data.worst10.map((item, index) => (
              <View key={item.objectID} style={styles.tableRow}>
                <Text style={styles.tableCol1}>{index + 1}</Text>
                <Text style={styles.tableCol2}>{item.Nom_fr}</Text>
                <Text style={styles.tableCol3}>{item.FE.toFixed(4)}</Text>
                <Text style={styles.tableCol4}>{item.Source}</Text>
                <Text style={styles.tableCol5}>{item.Date || '-'}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer} fixed>
          DataCarb - Benchmark Analysis • {today}
        </Text>
      </Page>
    </Document>
  );
};

