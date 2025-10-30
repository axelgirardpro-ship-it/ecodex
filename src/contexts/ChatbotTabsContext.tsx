import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ChatTab {
  id: string;
  source: string;
  productName: string;
  isMinimized: boolean;
}

interface ChatbotTabsContextValue {
  tabs: ChatTab[];
  activeTabId: string | null;
  addTab: (source: string, productName: string) => void;
  removeTab: (id: string) => void;
  minimizeTab: (id: string) => void;
  maximizeTab: (id: string) => void;
  setActiveTab: (id: string | null) => void;
}

const ChatbotTabsContext = createContext<ChatbotTabsContextValue | null>(null);

export const ChatbotTabsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [tabs, setTabs] = useState<ChatTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const MAX_TABS = 5;

  const addTab = (source: string, productName: string) => {
    // Vérifier si la limite est atteinte
    if (tabs.length >= MAX_TABS) {
      // Toast d'avertissement sera géré dans le composant qui appelle addTab
      console.warn(`Maximum de ${MAX_TABS} conversations atteint`);
      return;
    }

    // Vérifier si une conversation existe déjà pour cette combinaison
    const existingTab = tabs.find(tab => tab.source === source && tab.productName === productName);
    
    if (existingTab) {
      // Rouvrir l'onglet existant
      setActiveTabId(existingTab.id);
      if (existingTab.isMinimized) {
        maximizeTab(existingTab.id);
      }
      return;
    }

    // Créer un nouvel onglet
    const newTab: ChatTab = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      source,
      productName,
      isMinimized: false,
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const removeTab = (id: string) => {
    setTabs(prev => prev.filter(tab => tab.id !== id));
    if (activeTabId === id) {
      setActiveTabId(null);
    }
  };

  const minimizeTab = (id: string) => {
    setTabs(prev => 
      prev.map(tab => 
        tab.id === id ? { ...tab, isMinimized: true } : tab
      )
    );
    if (activeTabId === id) {
      setActiveTabId(null);
    }
  };

  const maximizeTab = (id: string) => {
    setTabs(prev => 
      prev.map(tab => 
        tab.id === id ? { ...tab, isMinimized: false } : tab
      )
    );
    setActiveTabId(id);
  };

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

