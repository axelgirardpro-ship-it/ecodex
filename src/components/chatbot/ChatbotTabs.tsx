import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Minus, Maximize2 } from 'lucide-react';
import { useChatbotTabs } from '@/contexts/ChatbotTabsContext';
import { LlamaCloudChatModal } from '@/components/search/LlamaCloudChatModal';
import { useSafeLanguage } from '@/hooks/useSafeLanguage';

export const ChatbotTabs: React.FC = () => {
  const { tabs, activeTabId, removeTab, minimizeTab, maximizeTab } = useChatbotTabs();
  const language = useSafeLanguage();

  if (tabs.length === 0) return null;

  const activeTab = tabs.find(tab => tab.id === activeTabId);

  return (
    <>
      {/* Barre d'onglets fixe en bas à droite */}
      <div className="fixed bottom-0 right-4 z-50 flex flex-row-reverse items-end gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const isMinimized = tab.isMinimized;

          return (
            <div
              key={tab.id}
              className={`
                bg-white border border-border rounded-t-lg shadow-lg overflow-hidden transition-all
                ${isActive && !isMinimized ? 'hidden' : ''}
                ${isMinimized ? 'cursor-pointer hover:bg-muted/50' : ''}
              `}
              style={{ maxWidth: '280px' }}
              onClick={() => isMinimized ? maximizeTab(tab.id) : undefined}
            >
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 border-b">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate text-foreground">
                    {tab.source}
                  </p>
                  <p className="text-[10px] truncate text-muted-foreground">
                    {tab.productName}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {!isMinimized && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        minimizeTab(tab.id);
                      }}
                      title={language === 'fr' ? 'Réduire' : 'Minimize'}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  )}
                  {isMinimized && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-muted"
                      onClick={(e) => {
                        e.stopPropagation();
                        maximizeTab(tab.id);
                      }}
                      title={language === 'fr' ? 'Agrandir' : 'Maximize'}
                    >
                      <Maximize2 className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTab(tab.id);
                    }}
                    title={language === 'fr' ? 'Fermer' : 'Close'}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modale du chatbot actif */}
      {activeTab && !activeTab.isMinimized && (
        <LlamaCloudChatModal
          isOpen={true}
          onClose={() => removeTab(activeTab.id)}
          onMinimize={() => minimizeTab(activeTab.id)}
          sourceName={activeTab.source}
          productName={activeTab.productName}
          language={language}
        />
      )}
    </>
  );
};

