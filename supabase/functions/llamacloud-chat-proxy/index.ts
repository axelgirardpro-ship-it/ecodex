import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

interface ChatRequest {
  message: string;
  source_name: string;
  product_context: string;
  language: 'fr' | 'en';
  history?: Array<{ role: 'user' | 'assistant', content: string }>;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    console.log('🔵 Incoming request:', req.method, req.url);

    // 1. Auth validation
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // 🔧 DEBUG MODE: Accept test token for Dashboard testing
    const DEBUG_MODE = Deno.env.get('DEBUG_MODE') === 'true';
    let user: any = null;
    
    if (DEBUG_MODE && token === 'test-dashboard-token') {
      console.log('🔧 DEBUG MODE: Using test user');
      user = { id: '00000000-0000-0000-0000-000000000000' }; // Test user ID
    } else {
      const { data: { user: authUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      
      if (authError || !authUser) {
        console.error('❌ Auth failed:', authError?.message);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      user = authUser;
    }

    console.log('✅ User authenticated:', user.id);

    // 2. Parse request
    const body: ChatRequest = await req.json();
    const { message, source_name, product_context, language, history = [] } = body;

    console.log('📝 Chat request:', { message: message.substring(0, 50), source_name, language, historyLength: history.length });

    // 3. Check quotas (skip in DEBUG_MODE)
    // ⚠️ On vérifie le quota mais on n'incrémente PAS encore
    // L'incrémentation se fera plus tard, APRÈS avoir vérifié que la source a de la doc
    let shouldIncrementQuota = false;
    let currentUsage = 0;
    
    if (!DEBUG_MODE) {
      // Get user's quotas from search_quotas (consolidated table)
      const { data: quotas, error: fetchError } = await supabaseAdmin
        .from('search_quotas')
        .select('chatbot_queries_used, chatbot_queries_limit')
        .eq('user_id', user.id)
        .single();

      if (fetchError || !quotas) {
        console.error('❌ No quotas found for user:', fetchError);
        return new Response(JSON.stringify({ 
          error: 'Quota data not found. Please contact support.'
        }), { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      currentUsage = quotas.chatbot_queries_used ?? 0;
      const limit = quotas.chatbot_queries_limit ?? 3;

      console.log('📊 Quota check:', { 
        user_id: user.id,
        currentUsage, 
        limit,
        raw_data: quotas 
      });

      if (currentUsage >= limit) {
        console.warn('⚠️ Quota exceeded');
        return new Response(JSON.stringify({ 
          error: limit === 3
            ? 'Trial quota exceeded (3/3). Upgrade to Pro!'
            : 'Monthly quota exceeded (50/50)',
          upgrade_url: '/settings?tab=billing'
        }), { 
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ✅ Quota OK, on pourra incrémenter plus tard (si doc disponible)
      shouldIncrementQuota = true;
      console.log('✅ Quota check passed, will increment later if documentation is available');
    } else {
      console.log('🔧 DEBUG MODE: Skipping quota check');
    }

    // 5. Call LlamaCloud Retrieve API (REST)
    const llamaCloudBaseUrl = Deno.env.get('LLAMA_CLOUD_BASE_URL')!;
    const llamaCloudApiKey = Deno.env.get('LLAMA_CLOUD_API_KEY')!;
    const pipelineId = Deno.env.get('LLAMA_CLOUD_PIPELINE_ID')!;
    
    // Fonction de normalisation (identique côté backend et metadata LlamaCloud)
    const normalizeSourceName = (name: string): string => {
      if (!name) return '';
      let normalized = name.toLowerCase().trim();
      normalized = normalized.replace(/\s*v\d+(\.\d+)*\s*$/i, '');
      normalized = normalized.replace(/\s+/g, ' ');
      return normalized;
    };
    
    // Normaliser la source demandée pour le filtre
    const normalizedSource = normalizeSourceName(source_name);
    
    // ⚠️ DÉSACTIVER le filtre LlamaCloud car l'API REST ne le supporte pas correctement
    // On fera le filtrage côté backend après récupération
    const llamaCloudFilters = null; // Pas de filtre LlamaCloud
    
    // 🔍 DEBUG: Afficher la requête complète envoyée à LlamaCloud
    const llamaCloudRequestBody: any = {
      query: message,
      similarity_top_k: 8,
      retrieval_mode: 'chunks',
      retrieve_mode: 'text_and_images'
    };
    
    // N'ajouter filters que s'il n'est pas null
    if (llamaCloudFilters !== null) {
      llamaCloudRequestBody.filters = llamaCloudFilters;
    }
    
    console.log('🔍 LlamaCloud retrieval config:', {
      similarity_top_k: 8,
      retrieval_mode: 'chunks',
      retrieve_mode: 'text_and_images',
      filters: llamaCloudFilters,
      requested_source: source_name,
      normalized_source: normalizedSource
    });
    
    console.log('📤 FULL REQUEST BODY sent to LlamaCloud:', JSON.stringify(llamaCloudRequestBody, null, 2));

    // Appel à LlamaCloud avec filtre par source_normalized
    const retrieveResponse = await fetch(
      `${llamaCloudBaseUrl}/api/v1/pipelines/${pipelineId}/retrieve`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${llamaCloudApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(llamaCloudRequestBody),
      }
    );

    if (!retrieveResponse.ok) {
      throw new Error(`LlamaCloud retrieve failed: ${retrieveResponse.status} ${retrieveResponse.statusText}`);
    }

    const retrieveData = await retrieveResponse.json();
    const nodesCount = retrieveData.retrieval_nodes?.length || 0;
    console.log('✅ Retrieved', nodesCount, 'nodes from LlamaCloud for source:', source_name);

    // Extract context, sources, and screenshots from nodes
    const nodes = retrieveData.retrieval_nodes || [];

    // DEBUG: Log ALL fields from first node to see what LlamaCloud returns
    if (nodes.length > 0) {
      console.log('🔍 FULL NODE STRUCTURE:', JSON.stringify({
        extra_info: nodes[0].node.extra_info,
        metadata: nodes[0].node.metadata,
        relationships: nodes[0].node.relationships,
      }, null, 2));
      
      // LOG CRITIQUE: Vérifier la source de chaque node retourné
      console.log('🔍 SOURCES RETURNED BY LLAMACLOUD:');
      nodes.forEach((node: any, idx: number) => {
        const info = node.node.extra_info || {};
        const meta = node.node.metadata || {};
        console.log(`  Node ${idx + 1}:`, {
          source_in_extra_info: info.source || info.Source || 'NOT FOUND',
          source_in_metadata: meta.source || meta.Source || 'NOT FOUND',
          file_name: info.file_name
        });
      });
    }
    
    // Note: normalizeSourceName est maintenant définie plus haut (ligne 127)
    // On réutilise normalizedSource qui a déjà été calculé
    const normalizedSourceRequested = normalizedSource;
    console.log('🔍 Normalized source requested:', normalizedSourceRequested, 'from:', source_name);

    // 🔍 DEBUG: Afficher TOUTES les métadonnées du premier node pour vérifier si source_normalized existe
    if (nodes.length > 0) {
      const firstNode = nodes[0];
      const info = firstNode.node.extra_info || {};
      const metadata = firstNode.node.metadata || {};
      
      console.log('🔍 FIRST NODE METADATA DEBUG:');
      console.log('  extra_info:', JSON.stringify(info, null, 2));
      console.log('  metadata:', JSON.stringify(metadata, null, 2));
      console.log('  Has source_normalized in extra_info?', 'source_normalized' in info);
      console.log('  Has source_normalized in metadata?', 'source_normalized' in metadata);
    }
    
    // ✅ FILTRAGE BACKEND avec source_normalized
    // Puisque l'API REST LlamaCloud ne supporte pas les filtres correctement,
    // on filtre côté backend en utilisant source_normalized des métadonnées
    console.log(`🔍 Filtering ${nodes.length} nodes by source_normalized="${normalizedSource}"`);
    
    const filteredNodes = nodes.filter((node: any) => {
      const info = node.node.extra_info || {};
      const nodeSourceNormalized = info.source_normalized || '';
      
      const matches = nodeSourceNormalized === normalizedSource;
      
      if (!matches && nodes.length < 20) {
        console.log(`⚠️ Node filtered out: source_normalized="${nodeSourceNormalized}" (expected: "${normalizedSource}")`);
      }
      
      return matches;
    });
    
    console.log(`✅ Filtered: ${filteredNodes.length}/${nodes.length} nodes match source_normalized="${normalizedSource}"`);
    
    // ✅ Détecter la version réelle utilisée (pour mentionner si différente de celle demandée)
    let actualSourceVersionUsed: string | null = null;
    
    if (filteredNodes.length > 0) {
      const info = filteredNodes[0].node.extra_info || {};
      const firstNodeSource = info.source || info.Source || '';
      if (firstNodeSource) {
        actualSourceVersionUsed = firstNodeSource;
      }
    }
    
    if (actualSourceVersionUsed && actualSourceVersionUsed !== source_name) {
      console.log(`ℹ️ Using actual source version: "${actualSourceVersionUsed}" (requested: "${source_name}")`);
    }
    
    // 🔍 DEBUG: Log scores des nodes filtrés
    if (filteredNodes.length > 0) {
      const nodesScores = filteredNodes.map((node: any, idx: number) => {
        const info = node.node.extra_info || {};
        const score = node.score || 0;
        const nodeSource = info.source || info.Source || 'UNKNOWN';
        return `Node ${idx + 1}: score=${score.toFixed(4)}, source=${nodeSource}`;
      }).join('\n  ');
      
      const bestScore = Math.max(...filteredNodes.map((n: any) => n.score || 0));
      console.log(`📊 SCORES DEBUG - Filtered nodes:\n  ${nodesScores}\n📊 BEST SCORE: ${bestScore.toFixed(4)}`);
    }
    
    // ⚡ Limiter à 5 sources maximum (augmenté de 3 pour améliorer la précision)
    const nodesToUse = filteredNodes.slice(0, 5);
    
    console.log(`📊 FINAL nodesToUse.length: ${nodesToUse.length}`);
    
    if (nodesToUse.length === 0) {
      console.warn('⚠️ No nodes found at all for source:', source_name);
      console.log('💡 No documentation available → NOT incrementing quota (user keeps credit)');
      
      const infoMessage = language === 'fr'
        ? `📚 **Documentation non disponible**\n\nLa source "${source_name}" n'est pas encore disponible dans l'agent documentaire.\n\n💡 **Pour obtenir des informations :**\n- Consultez la description sur la fiche du facteur d'émission\n- Visitez le site officiel de la source`
        : `📚 **Documentation not available**\n\nThe source "${source_name}" is not yet available in the documentation agent.\n\n💡 **To get information:**\n- Check the description on the emission factor page\n- Visit the source's official website`;
      
      return new Response(JSON.stringify({ 
        message: infoMessage,
        response_type: 'no_documentation',
        source_name: source_name
      }), { 
        status: 200,  // ✅ Success (comportement normal, pas une erreur)
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const sources = nodesToUse.map((node: any, idx: number) => {
      const info = node.node.extra_info || {};
      
      // PRIORITÉ 1: Utiliser le champ "url" de la metadata LlamaCloud (ajouté par l'utilisateur)
      let pdfUrl = info.url || info.pdf_url || null;
      
      // PRIORITÉ 2: Si pas d'URL dans la metadata, construire depuis le nom de fichier
      if (!pdfUrl) {
        const fileName = info.file_name || info.external_file_id;
        if (fileName) {
          pdfUrl = `${supabaseUrl}/storage/v1/object/public/documents/${fileName}`;
        }
      }
      
      // Ajouter l'ancre #page=N si on a un numéro de page
      const pageLabel = info.page_label || null;
      if (pdfUrl && pageLabel) {
        // Convertir page_label en nombre (peut être "116", "XVI", etc.)
        const pageNumber = parseInt(pageLabel, 10);
        if (!isNaN(pageNumber)) {
          pdfUrl = `${pdfUrl}#page=${pageNumber}`;
        }
      }
      
      // Titre du document: utiliser file_name
      const documentTitle = info.file_name || info.external_file_id || 'Document';
      
      // Titre du chunk/section: extraire la première ligne du texte ou un titre de section
      let chunkTitle = '';
      const nodeText = node.node.text || '';
      
      // Essayer d'extraire un titre de section (ligne commençant par # ou texte en gras)
      const firstLine = nodeText.split('\n')[0].trim();
      if (firstLine.length > 0 && firstLine.length < 150) {
        // Nettoyer les marqueurs markdown (##, **, etc.)
        chunkTitle = firstLine
          .replace(/^#+\s*/, '') // Enlever les #
          .replace(/\*\*/g, '')   // Enlever les **
          .replace(/^[\d.]+\s*/, '') // Enlever la numérotation
          .trim();
      }
      
      // Fallback: utiliser les 80 premiers caractères du texte
      if (!chunkTitle && nodeText.length > 0) {
        chunkTitle = nodeText.substring(0, 80).trim() + '...';
      }
      
      // Fallback final
      if (!chunkTitle) {
        chunkTitle = `Section ${idx + 1}`;
      }
      
      return {
        id: idx + 1,
        title: chunkTitle,
        documentTitle,
        url: pdfUrl,
        page: pageLabel,
        score: node.score || 0,
        external_file_id: info.external_file_id || info.file_id || null
      };
    }); // Uniquement les sources filtrées

    // Build context for OpenAI with URLs for clickable links (utiliser nodesToUse)
    const context = nodesToUse.map((node: any, idx: number) => {
      const info = node.node.extra_info || {};
      let pdfUrl = info.url || info.pdf_url || null;
      
      if (!pdfUrl) {
        const fileName = info.file_name || info.external_file_id;
        if (fileName) {
          pdfUrl = `${supabaseUrl}/storage/v1/object/public/documents/${fileName}`;
        }
      }
      
      const pageLabel = info.page_label || null;
      if (pdfUrl && pageLabel) {
        const pageNumber = parseInt(pageLabel, 10);
        if (!isNaN(pageNumber)) {
          pdfUrl = `${pdfUrl}#page=${pageNumber}`;
        }
      }
      
      return `[Source ${idx + 1}]${pdfUrl ? ` (URL: ${pdfUrl})` : ''}\n${node.node.text || ''}`;
    }).join('\n\n');

    // Extract ALL visual assets from extra_info (screenshots, charts, images) - utiliser nodesToUse
    const screenshots: string[] = [];
    const charts: string[] = [];
    const links: Array<{ text: string; url: string }> = [];
    
    for (const node of nodesToUse) {
      const info = node.node.extra_info || {};
      
      // DEBUG: Log ALL available fields in extra_info for first 2 nodes
      if (screenshots.length < 2) {
        console.log(`🔍 Node ${screenshots.length + 1} extra_info keys:`, Object.keys(info));
        console.log(`🔍 Node ${screenshots.length + 1} extra_info:`, JSON.stringify(info, null, 2).slice(0, 500));
      }
      
      // 📸 Screenshots (page entières) - Vérifier plusieurs champs possibles
      const pageScreenshot = 
        info.image_url || 
        info.screenshot_url || 
        info.page_screenshot ||
        info.screenshot ||
        info.image ||
        info.page_image ||
        info.figure_url;
        
      if (pageScreenshot) {
        console.log('✅ Found screenshot:', pageScreenshot);
        if (!screenshots.includes(pageScreenshot)) {
          screenshots.push(pageScreenshot);
        }
      } else {
        console.log('❌ No screenshot found in:', Object.keys(info));
      }
      
      // 📊 Charts (graphiques extraits)
      if (info.chart_url || info.image_path) {
        const chartUrl = info.chart_url || info.image_path;
        if (chartUrl && !charts.includes(chartUrl)) {
          charts.push(chartUrl);
        }
      }
      
      // 🔗 Links (liens annotés) - peuvent être dans plusieurs champs
      if (info.links && Array.isArray(info.links)) {
        info.links.forEach((link: any) => {
          if (link.url && !links.find(l => l.url === link.url)) {
            links.push({
              text: link.text || link.title || 'Lien',
              url: link.url
            });
          }
        });
      }
      
      // Limit to avoid overload
      if (screenshots.length >= 5 && charts.length >= 3 && links.length >= 5) break;
    }
    
    console.log('📸 Extracted screenshots:', screenshots.length);
    console.log('📊 Extracted charts:', charts.length);
    console.log('🔗 Extracted links:', links.length);

    // Build IMPROVED system prompt
    const languageInstruction = language === 'fr' 
      ? 'Réponds OBLIGATOIREMENT et EXCLUSIVEMENT en FRANÇAIS.' 
      : 'You MUST answer ONLY in ENGLISH.';
    
    const notFoundMessage = language === 'fr'
      ? `Je n'ai pas trouvé d'information exacte sur "${product_context}" dans ${source_name}. Voici ce que j'ai trouvé de plus proche :`
      : `I haven't found exact information about "${product_context}" in ${source_name}. Here's what I found that's closest:`;
    
    const systemPrompt = `You are an expert assistant in carbon methodologies for ${source_name}.

${languageInstruction}

CONTEXT:
Analyzed product: "${product_context}"
Source documentation: ${source_name}
${actualSourceVersionUsed && actualSourceVersionUsed !== source_name 
  ? `\n⚠️ ACTUAL DOCUMENTATION VERSION USED: "${actualSourceVersionUsed}"\n` 
  : ''}

${history.length > 0 ? `
CONVERSATION HISTORY:
${history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n')}

Use this context to better understand what the user is looking for.
` : ''}

RETRIEVED SOURCES FROM ${actualSourceVersionUsed || source_name}:
${context}

═══════════════════════════════════════════════════════════════
VERSION DIFFERENCE HANDLING:
═══════════════════════════════════════════════════════════════
${actualSourceVersionUsed && actualSourceVersionUsed !== source_name ? `
⚠️ The user requested "${source_name}" but the available documentation is from "${actualSourceVersionUsed}".

YOU MUST start your response with:
${language === 'fr'
  ? `"ℹ️ J'utilise la documentation de **${actualSourceVersionUsed}** (la version ${source_name} n'est pas disponible dans notre système)."`
  : `"ℹ️ I'm using documentation from **${actualSourceVersionUsed}** (version ${source_name} is not available in our system)."`}

Then proceed with answering the question using the ${actualSourceVersionUsed} documentation.
` : ''}

═══════════════════════════════════════════════════════════════
SEARCH STRATEGY:
═══════════════════════════════════════════════════════════════
1. FIRST: Search thoroughly in the provided sources for relevant information
2. If exact terms are not found, look for related concepts, synonyms, or categories
3. Use the conversation history to understand context and reformulate the query
4. ONLY if truly no relevant information exists after thorough search, suggest alternatives

DO NOT invent data or values not in the sources.

═══════════════════════════════════════════════════════════════
RESPONSE FORMAT:
═══════════════════════════════════════════════════════════════

1. CITATIONS: Always cite sources using clickable markdown links
   Format: [Source X](url) where url is provided in "Source X (URL: ...)"
   
2. FORMATTING:
   - Use **bold** for: numbers, values, dates, emission factors, key assumptions
   - Use blank lines between paragraphs (not \\n)
   - Structure with clear markdown headers (###)
   
3. FORMULAS (if present in sources):
   - Inline LaTeX: $CO_2$ for CO₂, $E = mc^2$ for formulas
   - Block LaTeX for complex formulas:
   
$$
Q_{CO_2,i} = \\frac{\\sum_{p=1}^9 (P_{p,i} \\times FE_p)}{\\sum_{p=1}^9 P_{p,i}}
$$

4. CONTENT:
   - Include methodological assumptions from the sources
   - Include relevant links if available: [Link text](url)
   - DO NOT add a "Sources" section at the end (displayed automatically)

5. IF INFORMATION NOT FOUND:
   ONLY if you've thoroughly checked and "${product_context}" is NOT in the sources:
   - State: "${notFoundMessage}"
   - Suggest 2-3 generic terms (e.g., "transport routier" instead of "Articulé 60-72 tonnes")
   - DO NOT invent general information not in the sources

${languageInstruction}`;

    // 6. Call OpenAI Chat Completions API (REST with streaming)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

    // Build conversation history with system prompt + history + current message
    const conversationMessages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    console.log('💬 Sending', conversationMessages.length, 'messages to OpenAI (including system prompt and', history.length, 'history messages)');

    // ✅ Documentation disponible → Incrémenter le quota MAINTENANT (juste avant streaming)
    if (shouldIncrementQuota) {
      const newUsage = currentUsage + 1;
      console.log('🔄 Documentation available → Incrementing quota from', currentUsage, 'to', newUsage);
      
      const { data: updateData, error: updateError } = await supabaseAdmin
        .from('search_quotas')
        .update({
          chatbot_queries_used: newUsage,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select('chatbot_queries_used');

      if (updateError) {
        console.error('❌ Failed to increment quota:', updateError);
        // Continue anyway - don't block the user
      } else {
        console.log('✅ Quota incremented successfully:', updateData);
      }
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: conversationMessages,
        temperature: 0.2,
        max_tokens: 2000,
        stream: true
      }),
    });

    if (!openaiResponse.ok) {
        throw new Error(`OpenAI API failed: ${openaiResponse.status} ${openaiResponse.statusText}`);
      }

    // Stream the response with metadata + Vercel AI SDK format
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // 1. Send metadata FIRST (sources, screenshots, charts, links)
          const metadata = {
            sources,
            screenshots,
            charts,
            links
          };
          controller.enqueue(encoder.encode(`___METADATA___\n${JSON.stringify(metadata)}\n___END_METADATA___\n`));

          // 2. Then stream OpenAI response
          const reader = openaiResponse.body!.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

            for (const line of lines) {
              const data = line.replace(/^data: /, '').trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                
                if (content) {
                  // Format Vercel AI SDK: 0:"text"
                  controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        } catch (error) {
          console.error('Stream error:', error);
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    console.error('❌ Chat proxy error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      type: error.name,
      stack: error.stack
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
