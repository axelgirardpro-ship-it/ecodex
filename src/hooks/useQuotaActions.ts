import { useCallback } from 'react';
import { useQuotas } from '@/hooks/useQuotas';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { EmissionFactor } from '@/types/emission-factor';
import type { AlgoliaHit } from '@/types/algolia';
import { useSafeLanguage } from '@/hooks/useSafeLanguage';

export const useQuotaActions = () => {
  const { 
    canExport: canExportQuota, 
    canCopyToClipboard: canCopyQuota,
    quotaData,
    incrementExport, 
    incrementClipboardCopy 
  } = useQuotas();
  const { canExport: canExportPermission } = usePermissions();
  const language = useSafeLanguage();

  const mapHitToLocalizedFactor = (hit: AlgoliaHit, lang: 'fr' | 'en'): EmissionFactor => {
    const isFR = lang === 'fr';
    const choose = (frKey: keyof AlgoliaHit, enKey: keyof AlgoliaHit, fallbackKey?: keyof AlgoliaHit) => {
      const primary = isFR ? hit[frKey] : hit[enKey];
      if (primary !== undefined && primary !== null && String(primary).trim() !== '') return String(primary);
      const secondary = isFR ? hit[enKey] : hit[frKey];
      if (secondary !== undefined && secondary !== null && String(secondary).trim() !== '') return String(secondary);
      if (fallbackKey) {
        const fallback = hit[fallbackKey];
        if (fallback !== undefined && fallback !== null && String(fallback).trim() !== '') return String(fallback);
      }
      return '';
    };

    return {
      id: hit.objectID,
      nom: choose('Nom_fr', 'Nom_en', 'Nom'),
      description: choose('Description_fr', 'Description_en', 'Description'),
      fe: hit.FE ?? 0,
      uniteActivite: choose('Unite_fr', 'Unite_en', "Unité donnée d'activité" as keyof AlgoliaHit),
      source: hit.Source,
      secteur: choose('Secteur_fr', 'Secteur_en', 'Secteur'),
      sousSecteur: choose('Sous-secteur_fr', 'Sous-secteur_en', 'Sous-secteur'),
      localisation: choose('Localisation_fr', 'Localisation_en', 'Localisation'),
      date: hit.Date ?? 0,
      incertitude: hit.Incertitude ?? '',
      perimetre: choose('Périmètre_fr', 'Périmètre_en', 'Périmètre'),
      contributeur: choose('Contributeur', 'Contributeur_en'),
      contributeur_en: String(hit.Contributeur_en ?? ''),
      methodologie: choose('Méthodologie', 'Méthodologie_en'),
      methodologie_en: String(hit.Méthodologie_en ?? ''),
      typeDonnees: choose('Type_de_données', 'Type_de_données_en'),
      typeDonnees_en: String(hit['Type_de_données_en'] ?? ''),
      commentaires: choose('Commentaires_fr', 'Commentaires_en', 'Commentaires'),
    };
  };

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

      const normalizedItems: EmissionFactor[] =
        items.length > 0 && 'objectID' in items[0]
          ? (items as AlgoliaHit[]).map((hit) => mapHitToLocalizedFactor(hit, language))
          : (items as EmissionFactor[]);

      const csvHeaders = language === 'fr'
        ? [
            'Nom',
            'Description',
            'FE',
            "Unité donnée d'activité",
            'Source',
            'Secteur',
            'Sous-secteur',
            'Localisation',
            'Date',
            'Incertitude',
            'Périmètre',
            'Contributeur',
            'Méthodologie',
            'Type_de_données',
            'Commentaires'
          ]
        : [
            'Name',
            'Description',
            'FE',
            'Activity unit',
            'Source',
            'Sector',
            'Sub-sector',
            'Location',
            'Date',
            'Uncertainty',
            'Perimeter',
            'Contributor',
            'Methodology',
            'Data type',
            'Comments'
          ];

      const csvData = [
        csvHeaders,
        ...normalizedItems.map(item =>
          language === 'fr'
            ? [
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
                item.methodologie || '',
                item.typeDonnees || '',
                item.commentaires || ''
              ]
            : [
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
                item.contributeur_en || item.contributeur || '',
                item.methodologie_en || item.methodologie || '',
                item.typeDonnees_en || item.typeDonnees || '',
                item.commentaires || ''
              ]
        )
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

      const normalizedItems: EmissionFactor[] =
        items.length > 0 && 'objectID' in items[0]
          ? (items as AlgoliaHit[]).map((hit) => mapHitToLocalizedFactor(hit, language))
          : (items as EmissionFactor[]);

      const headers = language === 'fr'
        ? ['Nom', 'Description', 'FE', "Unité donnée d'activité", 'Source', 'Secteur', 'Sous-secteur', 'Localisation', 'Date', 'Incertitude', 'Périmètre', 'Contributeur', 'Méthodologie', 'Type_de_données', 'Commentaires']
        : ['Name', 'Description', 'FE', 'Activity unit', 'Source', 'Sector', 'Sub-sector', 'Location', 'Date', 'Uncertainty', 'Perimeter', 'Contributor', 'Methodology', 'Data type', 'Comments'];

      const rows = normalizedItems.map(item =>
        language === 'fr'
          ? [
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
              item.methodologie || '',
              item.typeDonnees || '',
              item.commentaires || ''
            ]
          : [
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
              item.contributeur_en || item.contributeur || '',
              item.methodologie_en || item.methodologie || '',
              item.typeDonnees_en || item.typeDonnees || '',
              item.commentaires || ''
            ]
      );

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