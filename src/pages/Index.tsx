import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { POSView } from '@/components/pos/POSView';
import { MenuManager } from '@/components/pos/MenuManager';
import { InventoryView } from '@/components/pos/InventoryView';
import { SettingsView } from '@/components/pos/SettingsView';
import { OrderHistory } from '@/components/pos/OrderHistory';
import { Helmet } from 'react-helmet-async';
import { NeonProvider, useNeon } from '@/contexts/NeonContext';
import { Loader2 } from 'lucide-react';

const IndexContent = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const { isLoading } = useNeon();

  const renderContent = () => {
    switch (activeTab) {
      case 'pos':
        return <POSView />;
      case 'orders':
        return <OrderHistory />;
      case 'menu':
        return <MenuManager />;
      case 'inventory':
        return <InventoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <POSView />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Syncing with database...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Restaurant POS - Fast & Simple Point of Sale</title>
        <meta name="description" content="Lightweight POS system for restaurants. Generate bills, manage menu items, track inventory, and customize your brand." />
      </Helmet>
      <div className="flex h-screen bg-background overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
        <main className="flex-1 overflow-hidden">
          {renderContent()}
        </main>
      </div>
    </>
  );
};

const Index = () => {
  return (
    <NeonProvider>
      <IndexContent />
    </NeonProvider>
  );
};

export default Index;
