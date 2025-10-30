import { useEffect, useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Sparkles, X, Send, Loader2, FileText, Image as ImageIcon, Copy, Minus } from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import ReactMarkdown from 'react-markdown';
// @ts-ignore - remark-math types not available
import remarkMath from 'remark-math';
// @ts-ignore - rehype-katex types not available
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { QuotaIndicator } from '@/components/chatbot/QuotaIndicator';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// Types pour les messages
interface Source {
  id: number;
  title: string;
  documentTitle: string; // Titre du document complet
  url: string | null;
  page: string | null;
  score: number;
  external_file_id?: string | null; // Pour récupérer les page screenshots
}

interface Link {
  text: string;
  url: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  screenshots?: string[];
  charts?: string[];
  links?: Link[];
}

interface LlamaCloudChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize?: () => void;
  sourceName: string;
  productName: string;
  language: 'fr' | 'en';
}

// Custom hook simple pour le chat (sans dépendance à @ai-sdk/react)
const useSimpleChat = (session: any, sourceName: string, productName: string, language: 'fr' | 'en') => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/llamacloud-chat-proxy`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          source_name: sourceName,
          product_context: productName,
          language,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails = response.statusText;
        try {
          const errorJson = JSON.parse(errorText);
          // Si c'est une erreur de quota (429), afficher un message user-friendly
          if (response.status === 429) {
            errorDetails = language === 'fr'
              ? 'Vous avez atteint votre quota mensuel de recherche sur l\'agent documentaire. Contactez-nous si vous souhaitez ajouter des crédits supplémentaires pour les users de votre workspace.'
              : 'You have reached your monthly quota for the documentation agent. Contact us if you would like to add additional credits for your workspace users.';
          } else {
            errorDetails = errorJson.details || errorJson.error || errorText;
          }
        } catch (e) {
          errorDetails = errorText;
        }
        throw new Error(errorDetails);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Créer un message assistant vide
      const assistantMessageId = `assistant-${Date.now()}`;
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        sources: [],
        screenshots: [],
        charts: [],
        links: []
      }]);

      // Stream la réponse
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let metadataParsed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        // Parse metadata if not yet done
        if (!metadataParsed && buffer.includes('___END_METADATA___')) {
          const metadataMatch = buffer.match(/___METADATA___\n(.*?)\n___END_METADATA___/s);
          if (metadataMatch) {
            try {
              const metadata = JSON.parse(metadataMatch[1]);
              
              console.log('📦 METADATA RECEIVED:', metadata);
              
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { 
                      ...msg, 
                      sources: metadata.sources || [], 
                      screenshots: metadata.screenshots || [],
                      charts: metadata.charts || [],
                      links: metadata.links || []
                    }
                  : msg
              ));
            } catch (e) {
              console.error('Failed to parse metadata:', e);
            }
            buffer = buffer.replace(/___METADATA___\n.*?\n___END_METADATA___/s, '');
            metadataParsed = true;
          }
        }

        // Parse text chunks
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('0:')) {
            // Format de streaming Vercel AI SDK
            try {
              // Utiliser JSON.parse pour décoder correctement les \n et autres séquences d'échappement
              const content = JSON.parse(line.slice(2));
                  if (content) {
                    setMessages(prev => prev.map(msg => {
                      if (msg.id === assistantMessageId) {
                        const newContent = msg.content + content;
                        // Debug: log une fois toutes les 100 chars pour voir les formules
                        if (newContent.length % 100 < content.length) {
                          console.log('📝 Content sample:', newContent.slice(-200));
                        }
                        return { ...msg, content: newContent };
                      }
                      return msg;
                    }));
                  }
            } catch (e) {
              console.error('Failed to parse content chunk:', e);
            }
          }
        }
      }

      // Rafraîchir les quotas après un message réussi (chatbot modal + navbar)
      queryClient.invalidateQueries({ queryKey: ['my-chatbot-quota'] });
      queryClient.invalidateQueries({ queryKey: ['quotas'] }); // Pour le NavbarQuotaWidget

      setIsLoading(false);
    } catch (err) {
      console.error('❌ Chat error:', err);
      setError(err as Error);
      setIsLoading(false);
    }
  };

  return { messages, isLoading, error, sendMessage };
};

// Composant de chat avec custom hook simple
const ChatInterface: React.FC<{
  session: any;
  onClose: () => void;
  onMinimize?: () => void;
  sourceName: string;
  productName: string;
  language: 'fr' | 'en';
}> = ({ session, onClose, onMinimize, sourceName, productName, language }) => {
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Pré-remplir la question avec un template modifiable
  const defaultQuestion = language === 'fr' 
    ? `Peux-tu m'en dire plus sur ${productName} dans la source ${sourceName} ?`
    : `Can you tell me more about ${productName} in the ${sourceName} source?`;
  
  const [inputValue, setInputValue] = useState(defaultQuestion);

  // Custom hook simple
  const { messages, isLoading, error, sendMessage } = useSimpleChat(
    session,
    sourceName,
    productName,
    language
  );

  // Auto-scroll vers le bas lors de nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Gestion du submit
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedInput = inputValue.trim();
    if (trimmedInput) {
      sendMessage(trimmedInput);
      setInputValue('');
    }
  };

  const handleCopyConversation = async () => {
    if (messages.length === 0) return;

    const formattedConversation = messages.map((msg) => {
      const emoji = msg.role === 'user' ? '🧑' : '🤖';
      const role = msg.role === 'user' ? 'User' : 'Assistant';
      let text = `${emoji} ${role}: ${msg.content}\n`;
      
      if (msg.role === 'assistant' && msg.sources && msg.sources.length > 0) {
        text += '\n**Sources:**\n';
        msg.sources.forEach((source) => {
          text += `- [${source.title}](${source.url || '#'}) (${source.documentTitle}${source.page ? `, Page ${source.page}` : ''})\n`;
        });
      }
      
      return text;
    }).join('\n---\n\n');

    try {
      await navigator.clipboard.writeText(formattedConversation);
      toast({
        title: language === 'fr' ? 'Conversation copiée !' : 'Conversation copied!',
        description: language === 'fr' 
          ? 'La conversation complète a été copiée dans le presse-papier.' 
          : 'The complete conversation has been copied to clipboard.',
      });
    } catch (err) {
      toast({
        title: language === 'fr' ? 'Erreur' : 'Error',
        description: language === 'fr' 
          ? 'Impossible de copier la conversation.' 
          : 'Failed to copy conversation.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl w-[90vw] h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-primary" />
                {language === 'fr' ? 'Agent documentaire' : 'Documentation agent'} • {sourceName}
              </DialogTitle>
              <div className="mt-2">
                <QuotaIndicator compact />
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyConversation}
                disabled={messages.length === 0}
                title={language === 'fr' ? 'Copier la conversation' : 'Copy conversation'}
              >
                <Copy className="w-4 h-4" />
              </Button>
              {onMinimize && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMinimize}
                  title={language === 'fr' ? 'Réduire' : 'Minimize'}
                >
                  <Minus className="w-4 h-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                title={language === 'fr' ? 'Fermer' : 'Close'}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <DialogDescription className="sr-only">
            {language === 'fr' ? 'Agent documentaire pour' : 'Documentation agent for'} {sourceName}
          </DialogDescription>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-muted-foreground py-8">
              <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50 text-primary" />
              <p className="font-semibold text-foreground mb-2">
                {language === 'fr' ? 'Bienvenue sur l\'Agent documentaire Ecodex.' : 'Welcome to the Ecodex Documentation Agent.'}
              </p>
              <p className="mb-3">
                {language === 'fr' 
                  ? `Faisons une recherche sur la documentation ${sourceName} !` 
                  : `Let's search the ${sourceName} documentation!`}
              </p>
              <p className="text-xs italic text-muted-foreground">
                {language === 'fr'
                  ? 'Nous vous invitons à vérifier chaque réponse proposée par notre agent via les liens des sources identifiées !'
                  : 'We invite you to verify each response provided by our agent through the links of the identified sources!'}
                <br />
                {language === 'fr'
                  ? 'Assurez-vous d\'avoir consulté toutes les informations déjà disponibles sur la fiche du FE.'
                  : 'Make sure you have reviewed all information already available on the EF sheet.'}
              </p>
            </div>
          )}
          
          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`rounded-lg px-4 py-3 max-w-[80%] ${
                  m.role === 'user'
                    ? 'bg-white border border-border'
                    : 'bg-white border border-border shadow-sm'
                }`}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap text-foreground">{m.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                      components={{
                        // Custom rendering for better styling and spacing
                        h1: ({node, ...props}) => <h1 className="text-xl font-bold mt-6 mb-3 text-foreground" {...props} />,
                        h2: ({node, ...props}) => <h2 className="text-lg font-bold mt-5 mb-3 text-foreground" {...props} />,
                        h3: ({node, ...props}) => <h3 className="text-base font-semibold mt-4 mb-2 text-foreground" {...props} />,
                        p: ({node, ...props}) => <p className="mb-3 leading-relaxed text-foreground" {...props} />,
                        ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-3 space-y-1" {...props} />,
                        ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-3 space-y-1" {...props} />,
                        li: ({node, ...props}) => <li className="mb-1" {...props} />,
                        strong: ({node, ...props}) => <strong className="font-semibold text-foreground" {...props} />,
                        code: ({node, ...props}: any) => {
                          const isInline = !props.className?.includes('language-');
                          return isInline 
                            ? <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
                            : <code className="block bg-muted p-3 rounded my-3 overflow-x-auto" {...props} />;
                        },
                        blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-primary pl-4 italic my-3" {...props} />
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Sources et Screenshots pour les messages assistant */}
              {m.role === 'assistant' && (m.sources?.length > 0 || m.screenshots?.length > 0) && (() => {
                // Afficher TOUTES les sources (comme le playground)
                const allSources = m.sources || [];
                
                return (
                  <div className="mt-3 max-w-[80%] w-full space-y-3">
                    {/* Sources dans un accordéon */}
                    {allSources.length > 0 && (
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="sources" className="border rounded-lg">
                          <AccordionTrigger className="px-4 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-primary" />
                              <span className="font-semibold text-sm">{language === 'fr' ? 'Sources utilisées' : 'Sources used'} ({allSources.length})</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="space-y-2">
                              {allSources.map((source) => (
                                <div key={source.id} className="bg-white hover:bg-accent/50 transition-colors rounded-lg p-3 border border-border">
                                  <div className="flex items-start gap-3">
                                    <FileText className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                                    <div className="flex-1 min-w-0 space-y-1">
                                      <p className="font-medium text-sm text-foreground leading-snug">
                                        {source.title}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {source.documentTitle}
                                        {source.page && ` • Page ${source.page}`}
                                      </p>
                                      {source.url && source.url.startsWith('http') && (
                                        <a 
                                          href={source.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          onClick={(e) => {
                                            console.log('🔗 Click on source:', source.url);
                                            if (e.metaKey || e.ctrlKey) return;
                                            e.preventDefault();
                                            window.open(source.url, '_blank', 'noopener,noreferrer');
                                          }}
                                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline cursor-pointer font-medium mt-1"
                                        >
                                          📄 Voir le PDF →
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    )}

                  {/* Screenshots - Dans un accordéon */}
                  {m.screenshots && m.screenshots.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                      <AccordionItem value="screenshots" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm hover:no-underline">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            <span className="font-semibold">{language === 'fr' ? 'Captures d\'écran' : 'Screenshots'} ({m.screenshots.length})</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 gap-3 pt-2">
                            {m.screenshots.map((screenshot, idx) => (
                              <img
                                key={idx}
                                src={screenshot}
                                alt={`Screenshot ${idx + 1}`}
                                className="rounded border w-full"
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}

                  {/* Charts - Dans un accordéon */}
                  {m.charts && m.charts.length > 0 && (
                    <Accordion type="single" collapsible className="w-full mt-3">
                      <AccordionItem value="charts" className="border rounded-lg px-4">
                        <AccordionTrigger className="text-sm hover:no-underline">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4" />
                            <span className="font-semibold">{language === 'fr' ? 'Graphiques' : 'Charts'} ({m.charts.length})</span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="grid grid-cols-1 gap-3 pt-2">
                            {m.charts.map((chart, idx) => (
                              <img
                                key={idx}
                                src={chart}
                                alt={`Chart ${idx + 1}`}
                                className="rounded border w-full bg-white p-2"
                              />
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}

                  {/* Links - Affichés directement */}
                  {m.links && m.links.length > 0 && (
                    <div className="bg-background border rounded-lg p-4 mt-3">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-primary" />
                        <span className="font-semibold text-sm">{language === 'fr' ? 'Liens utiles' : 'Useful links'} ({m.links.length})</span>
                      </div>
                      <div className="space-y-2">
                        {m.links.map((link, idx) => (
                          <a 
                            key={idx}
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            🔗 {link.text}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  </div>
                );
              })()}
            </div>
          ))}
          
          {isLoading && messages.length > 0 && messages[messages.length - 1].role === 'user' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin" />
              </div>
            </div>
          )}

          {error && (
            <div className="flex justify-start">
              <div className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 max-w-[80%]">
                <p className="font-semibold mb-1">❌ {language === 'fr' ? 'Erreur' : 'Error'}</p>
                <p className="text-sm">{error.message}</p>
              </div>
            </div>
          )}
          
          {/* Anchor for auto-scroll */}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t p-4">
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={language === 'fr' ? 'Votre question...' : 'Your question...'}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !inputValue.trim()} size="sm">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Wrapper qui charge la session
const LlamaCloudChatModalContent: React.FC<Omit<LlamaCloudChatModalProps, 'isOpen'>> = (props) => {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
      }
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <Dialog open={true} onOpenChange={props.onClose}>
        <DialogContent className="flex items-center justify-center h-[400px]">
          <DialogTitle className="sr-only">Loading</DialogTitle>
          <DialogDescription className="sr-only">Loading chat</DialogDescription>
          <Loader2 className="w-8 h-8 animate-spin" />
        </DialogContent>
      </Dialog>
    );
  }

  if (!session) {
    return (
      <Dialog open={true} onOpenChange={props.onClose}>
        <DialogContent className="flex items-center justify-center h-[400px]">
          <DialogTitle className="sr-only">Error</DialogTitle>
          <DialogDescription className="sr-only">Authentication error</DialogDescription>
          <p className="text-destructive">Erreur d'authentification</p>
        </DialogContent>
      </Dialog>
    );
  }

  return <ChatInterface session={session} {...props} />;
};

export const LlamaCloudChatModal: React.FC<LlamaCloudChatModalProps> = (props) => {
  if (!props.isOpen) return null;
  return <LlamaCloudChatModalContent {...props} />;
};
