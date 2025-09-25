import { useCallback } from 'react';
import { useQuotas } from '@/hooks/useQuotas';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { EmissionFactor } from '@/types/emission-factor';
import type { AlgoliaHit } from '@/types/algolia';

export const useQuotaActions = () => {
  const { 
    canExport: canExportQuota, 
    canCopyToClipboard: canCopyQuota,
    quotaData,
    incrementExport, 
    incrementClipboardCopy 
  } = useQuotas();
  const { canExport: canExportPermission } = usePermissions();

  const mapHitToEmissionFactor = (hit: AlgoliaHit): EmissionFactor => ({
    id: hit.objectID,
    nom: (hit as any).Nom_fr || (hit as any).Nom_en || (hit as any).Nom || '',
    description: (hit as any).Description_fr || (hit as any).Description_en || (hit as any).Description || '',
    fe: hit.FE as number,
    uniteActivite: (hit as any).Unite_fr || (hit as any).Unite_en || (hit as any)["Unité donnée d'activité"] || '',
    source: hit.Source,
    secteur: (hit as any).Secteur_fr || (hit as any).Secteur_en || (hit as any).Secteur || '',
    sousSecteur: (hit as any)['Sous-secteur_fr'] || (hit as any)['Sous-secteur_en'] || (hit as any)['Sous-secteur'] || '',
    localisation: (hit as any).Localisation_fr || (hit as any).Localisation_en || (hit as any).Localisation || '',
    date: (hit.Date as number) || 0,
    incertitude: hit.Incertitude as string,
    perimetre: (hit as any)['Périmètre_fr'] || (hit as any)['Périmètre_en'] || (hit as any)['Périmètre'] || '',
    contributeur: (hit as any).Contributeur || (hit as any).Contributeur_en || '',
    contributeur_en: (hit as any).Contributeur_en || '',
    methodologie: (hit as any).Méthodologie || (hit as any).Méthodologie_en || '',
    methodologie_en: (hit as any).Méthodologie_en || '',
    typeDonnees: (hit as any)['Type_de_données'] || (hit as any)['Type_de_données_en'] || '',
    typeDonnees_en: (hit as any)['Type_de_données_en'] || '',
    commentaires: (hit as any).Commentaires_fr || (hit as any).Commentaires_en || (hit as any).Commentaires || '',
  });

  const handleExport = useCallback(async (
    items: EmissionFactor[] | AlgoliaHit[], 
    filename: string = 'emission_factors'
  ) => {
    if (!canExportPermission) {
      toast.error('Vous n\'avez pas les permissions pour exporter');
      return false;
    }

    if (items.length === 0) {
      toast.error('Aucun élément sélectionné pour l\'export');
      return false;
    }

    if (!canExportQuota) {
      toast.error('Limite d\'exports atteinte pour ce mois');
      return false;
    }

    if (quotaData?.exports_limit !== null && quotaData) {
      const remainingQuota = quotaData.exports_limit - quotaData.exports_used;
      if (items.length > remainingQuota) {
        toast.error(`Quota insuffisant. Il vous reste ${remainingQuota} export(s) disponible(s), mais vous tentez d'exporter ${items.length} élément(s).`);
        return false;
      }
    }

    try {
      await incrementExport(items.length);

      let normalizedItems: EmissionFactor[];
      if (items.length > 0 && 'objectID' in items[0]) {
        normalizedItems = (items as AlgoliaHit[]).map(mapHitToEmissionFactor);
      } else {
        normalizedItems = items as EmissionFactor[];
      }

      const csvHeaders = [
        'Nom',
        'Nom_en',
        'Description',
        'Description_en',
        'FE',
        "Unité donnée d'activité",
        'Unite_en',
        'Source',
        'Secteur',
        'Secteur_en',
        'Sous-secteur',
        'Sous-secteur_en',
        'Localisation',
        'Localisation_en',
        'Date',
        'Incertitude',
        'Périmètre',
        'Périmètre_en',
        'Contributeur',
        'Contributeur_en',
        'Méthodologie',
        'Méthodologie_en',
        'Type_de_données',
        'Type_de_données_en',
        'Commentaires',
        'Commentaires_en'
      ];

      const csvData = [
        csvHeaders,
        ...normalizedItems.map(item => [
          item.nom || '',
          '',
          item.description || '',
          '',
          item.fe?.toString() || '',
          item.uniteActivite || '',
          '',
          item.source || '',
          item.secteur || '',
          '',
          item.sousSecteur || '',
          '',
          item.localisation || '',
          '',
          item.date?.toString() || '',
          item.incertitude || '',
          item.perimetre || '',
          '',
          item.contributeur || '',
          item.contributeur_en || '',
          item.methodologie || '',
          item.methodologie_en || '',
          item.typeDonnees || '',
          item.typeDonnees_en || '',
          item.commentaires || '',
          ''
        ])
      ];

      const csvContent = csvData.map(row => 
        row.map(field => `"${String(field).replace(/"/g, '""')}"`).join(',')
      ).join('\n');

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

    if (!canCopyQuota) {
      toast.error('Limite de copies atteinte pour ce mois');
      return false;
    }

    if (quotaData?.clipboard_copies_limit !== null && quotaData) {
      const remainingQuota = quotaData.clipboard_copies_limit - quotaData.clipboard_copies_used;
      if (items.length > remainingQuota) {
        toast.error(`Quota insuffisant. Il vous reste ${remainingQuota} copie(s) disponible(s), mais vous tentez de copier ${items.length} élément(s).`);
        return false;
      }
    }

    try {
      await incrementClipboardCopy(items.length);

      let normalizedItems: EmissionFactor[];
      if (items.length > 0 && 'objectID' in items[0]) {
        normalizedItems = (items as AlgoliaHit[]).map(mapHitToEmissionFactor);
      } else {
        normalizedItems = items as EmissionFactor[];
      }

      const headers = [
        'Nom', 'Nom_en', 'Description', 'Description_en', 'FE', 'Unité donnée d\'activité', 'Unite_en', 'Source',
        'Secteur', 'Secteur_en', 'Sous-secteur', 'Sous-secteur_en', 'Localisation', 'Localisation_en', 'Date', 'Incertitude',
        'Périmètre', 'Périmètre_en', 'Contributeur', 'Contributeur_en', 'Méthodologie', 'Méthodologie_en', 'Type_de_données', 'Type_de_données_en', 'Commentaires', 'Commentaires_en'
      ];

      const rows = normalizedItems.map(item => [
        item.nom || '', '', item.description || '', '', item.fe?.toString() || '', item.uniteActivite || '', '', item.source || '',
        item.secteur || '', '', item.sousSecteur || '', '', item.localisation || '', '', item.date?.toString() || '', item.incertitude || '',
        item.perimetre || '', '', item.contributeur || '', item.contributeur_en || '', item.methodologie || '', item.methodologie_en || '', item.typeDonnees || '', item.typeDonnees_en || '', item.commentaires || '', ''
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