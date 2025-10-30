import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    title: string;
    documentTitle: string;
    page?: number;
    url?: string;
  }>;
}

export interface ChatTab {
  id: string;
  source: string;
  productName: string;
  isMinimized: boolean;
  messages: ChatMessage[];
}

interface ChatbotTabsContextValue {
  tabs: ChatTab[];
  activeTabId: string | null;
  addTab: (source: string, productName: string) => void;
  removeTab: (id: string) => void;
  minimizeTab: (id: string) => void;
  maximizeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
  updateTabMessages: (id: string, messages: ChatMessage[]) => void;
}

const ChatbotTabsContext = createContext<ChatbotTabsContextValue | null>(null);

export const ChatbotTabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const MAX_TABS = 5;

  const maximizeTab = useCallback((id: string) => {
    setTabs(prev => 
      prev.map(tab => 
        tab.id === id ? { ...tab, isMinimized: false } : tab
      )
    );
    setActiveTabId(id);
  }, []);

  const addTab = useCallback((source: string, productName: string) => {
    // Vérifier si la limite est atteinte
    setTabs(prev => {
      if (prev.length >= MAX_TABS) {
        console.warn(`Maximum de ${MAX_TABS} conversations atteint`);
        return prev;
      }

      // Vérifier si une conversation existe déjà pour cette combinaison
      const existingTab = prev.find(tab => tab.source === source && tab.productName === productName);
      
      if (existingTab) {
        // Rouvrir l'onglet existant
        setActiveTabId(existingTab.id);
        if (existingTab.isMinimized) {
          maximizeTab(existingTab.id);
        }
        return prev;
      }

      // Créer un nouvel onglet
      const newTab: ChatTab = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        source,
        productName,
        isMinimized: false,
        messages: [],
      };

      setActiveTabId(newTab.id);
      return [...prev, newTab];
    });
  }, [maximizeTab]);

  const removeTab = useCallback((id: string) => {
    setTabs(prev => prev.filter(tab => tab.id !== id));
    setActiveTabId(prev => prev === id ? null : prev);
  }, []);

  const minimizeTab = useCallback((id: string) => {
    setTabs(prev => 
      prev.map(tab => 
        tab.id === id ? { ...tab, isMinimized: true } : tab
      )
    );
    setActiveTabId(prev => prev === id ? null : prev);
  }, []);

  const updateTabMessages = useCallback((id: string, messages: ChatMessage[]) => {
    setTabs(prev => 
      prev.map(tab => 
        tab.id === id ? { ...tab, messages } : tab
      )
    );
  }, []);

  return (
    <ChatbotTabsContext.Provider
      value={{
        tabs,
        activeTabId,
        addTab,
        removeTab,
        minimizeTab,
        maximizeTab,
        setActiveTab: setActiveTabId,
        updateTabMessages,
      }}
    >
      {children}
    </ChatbotTabsContext.Provider>
  );
};

export const useChatbotTabs = (): ChatbotTabsContextValue => {
  const context = useContext(ChatbotTabsContext);
  if (!context) {
    throw new Error('useChatbotTabs must be used within a ChatbotTabsProvider');
  }
  return context;
};

