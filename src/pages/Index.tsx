import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { POSView } from '@/components/pos/POSView';
import { MenuManager } from '@/components/pos/MenuManager';
import { InventoryView } from '@/components/pos/InventoryView';
import { SettingsView } from '@/components/pos/SettingsView';
import { OrderHistory } from '@/components/pos/OrderHistory';
import { Helmet } from 'react-helmet-async';
import { NeonProvider, useNeon } from '@/contexts/NeonContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const IndexContent = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const { isLoading } = useNeon();
  const { isTrialActive, trialDaysRemaining } = useAuth();

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
      <div className="flex h-screen bg-background overflow-hidden flex-col">
        {/* Trial Banner */}
        {isTrialActive && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">
                Free Trial: {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} remaining
              </span>
            </div>
            <Link to="/auth">
              <Button size="sm" variant="secondary" className="h-7 text-xs">
                <Crown className="h-3 w-3 mr-1" />
                Upgrade Now
              </Button>
            </Link>
          </div>
        )}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
          <main className="flex-1 overflow-hidden">
            {renderContent()}
          </main>
        </div>
      </div>
    </>
  );
};

// Main Index component wraps content with NeonProvider
const Index = () => (
  <NeonProvider>
    <IndexContent />
  </NeonProvider>
);

export default Index;
