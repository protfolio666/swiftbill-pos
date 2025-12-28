import React, { createContext, useContext, ReactNode } from 'react';
import { useNeonSync } from '@/hooks/useNeonSync';
import { MenuItem, Order } from '@/types/pos';

interface NeonContextType {
  isLoading: boolean;
  isSynced: boolean;
  isOnline: boolean;
  syncError: string | null;
  refresh: () => Promise<void>;
  addCategory: (name: string, icon: string) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  addMenuItem: (item: Omit<MenuItem, 'id'>, categoryId: number | null) => Promise<boolean>;
  updateMenuItem: (id: string, item: Partial<MenuItem>, categoryId: number | null) => Promise<boolean>;
  deleteMenuItem: (id: string) => Promise<boolean>;
  saveOrder: (order: Order) => Promise<boolean>;
  saveBrandSettings: (settings: { 
    name: string; 
    currency: string; 
    logo?: string;
    upiId?: string;
    taxRate?: number;
    enableGST?: boolean;
    cgstRate?: number;
    sgstRate?: number;
  }) => Promise<boolean>;
}

const NeonContext = createContext<NeonContextType | null>(null);

export function NeonProvider({ children }: { children: ReactNode }) {
  const neonSync = useNeonSync();

  return (
    <NeonContext.Provider value={neonSync}>
      {children}
    </NeonContext.Provider>
  );
}

export function useNeon() {
  const context = useContext(NeonContext);
  if (!context) {
    throw new Error('useNeon must be used within a NeonProvider');
  }
  return context;
}