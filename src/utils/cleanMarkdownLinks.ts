/**
 * Nettoie les balises HTML de highlighting Algolia (<mark>, <em>, etc.) 
 * présentes dans les URLs des liens markdown.
 * 
 * Problème : Algolia insère des balises <mark> pour le highlighting des termes recherchés,
 * mais ces balises peuvent se retrouver à l'intérieur des URLs markdown, les rendant invalides.
 * 
 * Exemple :
 * Entrée : "[Source](https://example.com/<mark>google</mark>-report.pdf)"
 * Sortie : "[Source](https://example.com/google-report.pdf)"
 * 
 * Le highlighting est préservé dans le texte du lien (partie entre crochets).
 * 
 * @param content - Contenu contenant potentiellement des liens markdown avec balises HTML
 * @returns Contenu avec URLs nettoyées
 */
export function cleanMarkdownLinks(content: string): string {
  // Regex pour capturer les liens markdown : [texte](url)
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  return content.replace(markdownLinkRegex, (match, text, url) => {
    // Nettoyer uniquement l'URL (partie entre parenthèses)
    let cleanUrl = url
      // Supprimer balises HTML brutes : <mark>, </mark>, <em>, </em>, <strong>, </strong>
      .replace(/<\/?(?:mark|em|strong)>/gi, '')
      // Supprimer balises URL-encodées (majuscules) : %3Cmark%3E, %3C/mark%3E
      .replace(/%3C\/?(?:mark|em|strong)%3E/gi, '')
      // Supprimer balises URL-encodées (minuscules) : %3cmark%3e, %3c/mark%3e
      .replace(/%3c\/?(?:mark|em|strong)%3e/gi, '');
    
    // Retourner le lien avec URL nettoyée, texte inchangé (garde le highlighting)
    return `[${text}](${cleanUrl})`;
  });
}

