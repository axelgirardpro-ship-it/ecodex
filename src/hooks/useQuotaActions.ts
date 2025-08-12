import { useCallback } from 'react';
import { useQuotas } from '@/hooks/useQuotas';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { EmissionFactor } from '@/types/emission-factor';

// Type pour les données Algolia
interface AlgoliaHit {
  objectID: string;
  Nom: string;
  Description: string;
  FE: number;
  'Unité donnée d\'activité': string;
  Source: string;
  Secteur: string;
  'Sous-secteur': string;
  Localisation: string;
  Date: number;
  Incertitude: string;
  Périmètre: string;
  Contributeur: string;
  Commentaires: string;
}

export const useQuotaActions = () => {
  const { 
    canExport: canExportQuota, 
    canCopyToClipboard: canCopyQuota,
    quotaData,
    incrementExport, 
    incrementClipboardCopy 
  } = useQuotas();
  const { canExport: canExportPermission } = usePermissions();

  // Fonction pour mapper les hits Algolia vers EmissionFactor
  const mapHitToEmissionFactor = (hit: AlgoliaHit): EmissionFactor => ({
    id: hit.objectID,
    nom: hit.Nom,
    description: hit.Description,
    fe: hit.FE,
    uniteActivite: hit['Unité donnée d\'activité'],
    source: hit.Source,
    secteur: hit.Secteur,
    sousSecteur: hit['Sous-secteur'],
    localisation: hit.Localisation,
    date: hit.Date,
    incertitude: hit.Incertitude,
    perimetre: hit.Périmètre,
    contributeur: hit.Contributeur,
    commentaires: hit.Commentaires,
  });

  const handleExport = useCallback(async (
    items: EmissionFactor[] | AlgoliaHit[], 
    filename: string = 'emission_factors'
  ) => {
    // Vérifier les permissions
    if (!canExportPermission) {
      toast.error('Vous n\'avez pas les permissions pour exporter');
      return false;
    }

    if (items.length === 0) {
      toast.error('Aucun élément sélectionné pour l\'export');
      return false;
    }

    // Vérifier les quotas - considérer le nombre d'éléments
    if (!canExportQuota) {
      toast.error('Limite d\'exports atteinte pour ce mois');
      return false;
    }

    // Vérifier si le quota restant est suffisant pour le nombre d'éléments sélectionnés
    if (quotaData?.exports_limit !== null && quotaData) {
      const remainingQuota = quotaData.exports_limit - quotaData.exports_used;
      if (items.length > remainingQuota) {
        toast.error(`Quota insuffisant. Il vous reste ${remainingQuota} export(s) disponible(s), mais vous tentez d'exporter ${items.length} élément(s).`);
        return false;
      }
    }

    try {
      // Incrémenter le quota d'abord avec le nombre d'éléments
      await incrementExport(items.length);

      // Normaliser les données - supporter les deux types
      let normalizedItems: EmissionFactor[];
      if (items.length > 0 && 'objectID' in items[0]) {
        // Items are AlgoliaHit type
        normalizedItems = (items as AlgoliaHit[]).map(mapHitToEmissionFactor);
      } else {
        // Items are already EmissionFactor type
        normalizedItems = items as EmissionFactor[];
      }

      // Créer le CSV
      const csvHeaders = [
        "Nom",
        "Description", 
        "FE",
        "Unité donnée d'activité",
        "Source",
        "Secteur",
        "Sous-secteur",
        "Localisation",
        "Date",
        "Incertitude",
        "Périmètre",
        "Contributeur",
        "Commentaires"
      ];

      const csvData = [
        csvHeaders,
        ...normalizedItems.map(item => [
          item.nom || '',
          item.description || '',
          item.fe?.toString() || '',
          item.uniteActivite || '',
          item.source || '',
          item.secteur || '',
          item.sousSecteur || '',
          item.localisation || '',
          item.date?.toString() || '',
          item.incertitude || '',
          item.perimetre || '',
          item.contributeur || '',
          item.commentaires || ''
        ])
      ];

      const csvContent = csvData.map(row => 
        row.map(field => `"${field.replace(/"/g, '""')}"`).join(',')
      ).join('\n');

      // Télécharger le fichier
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
      URL.revokeObjectURL(link.href);

      toast.success(`${normalizedItems.length} facteur(s) d'émission exporté(s)`);
      return true;
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      toast.error('Erreur lors de l\'export');
      return false;
    }
  }, [canExportPermission, canExportQuota, quotaData, incrementExport]);

  const handleCopyToClipboard = useCallback(async (items: EmissionFactor[] | AlgoliaHit[]) => {
    if (items.length === 0) {
      toast.error('Aucun élément sélectionné pour la copie');
      return false;
    }

    // Vérifier les quotas
    if (!canCopyQuota) {
      toast.error('Limite de copies atteinte pour ce mois');
      return false;
    }

    // Vérifier si le quota restant est suffisant pour le nombre d'éléments sélectionnés
    if (quotaData?.clipboard_copies_limit !== null && quotaData) {
      const remainingQuota = quotaData.clipboard_copies_limit - quotaData.clipboard_copies_used;
      if (items.length > remainingQuota) {
        toast.error(`Quota insuffisant. Il vous reste ${remainingQuota} copie(s) disponible(s), mais vous tentez de copier ${items.length} élément(s).`);
        return false;
      }
    }

    try {
      // Incrémenter le quota d'abord avec le nombre d'éléments
      await incrementClipboardCopy(items.length);

      // Normaliser les données - supporter les deux types
      let normalizedItems: EmissionFactor[];
      if (items.length > 0 && 'objectID' in items[0]) {
        // Items are AlgoliaHit type
        normalizedItems = (items as AlgoliaHit[]).map(mapHitToEmissionFactor);
      } else {
        // Items are already EmissionFactor type
        normalizedItems = items as EmissionFactor[];
      }

      // Créer les données pour le presse-papier
      const headers = [
        'Nom', 'Description', 'FE', 'Unité', 'Source', 'Secteur', 'Sous-secteur',
        'Localisation', 'Date', 'Incertitude', 'Périmètre', 'Contributeur', 'Commentaires'
      ];

      const rows = normalizedItems.map(item => [
        item.nom || '',
        item.description || '',
        item.fe?.toString() || '',
        item.uniteActivite || '',
        item.source || '',
        item.secteur || '',
        item.sousSecteur || '',
        item.localisation || '',
        item.date?.toString() || '',
        item.incertitude || '',
        item.perimetre || '',
        item.contributeur || '',
        item.commentaires || ''
      ]);

      const allData = [headers, ...rows];
      const textData = allData.map(row => row.join('\t')).join('\n');

      await navigator.clipboard.writeText(textData);
      toast.success(`${normalizedItems.length} facteur(s) d'émission copié(s) dans le presse-papier`);
      return true;
    } catch (error) {
      console.error('Erreur lors de la copie:', error);
      toast.error('Erreur lors de la copie dans le presse-papier');
      return false;
    }
  }, [canCopyQuota, quotaData, incrementClipboardCopy]);

  return {
    handleExport,
    handleCopyToClipboard,
    canExport: canExportPermission && canExportQuota,
    canCopyToClipboard: canCopyQuota
  };
};