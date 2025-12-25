import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { POSView } from '@/components/pos/POSView';
import { MenuManager } from '@/components/pos/MenuManager';
import { InventoryView } from '@/components/pos/InventoryView';
import { SettingsView } from '@/components/pos/SettingsView';
import { Helmet } from 'react-helmet-async';

const Index = () => {
  const [activeTab, setActiveTab] = useState('pos');

  const renderContent = () => {
    switch (activeTab) {
      case 'pos':
        return <POSView />;
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

export default Index;
