import { useState, useEffect } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { MobileNav } from '@/components/pos/MobileNav';
import { MobileCart } from '@/components/pos/MobileCart';
import { POSView } from '@/components/pos/POSView';
import { MenuManager } from '@/components/pos/MenuManager';
import { InventoryView } from '@/components/pos/InventoryView';
import { SettingsView } from '@/components/pos/SettingsView';
import { OrderHistory } from '@/components/pos/OrderHistory';
import { Helmet } from 'react-helmet-async';
import { NeonProvider, useNeon } from '@/contexts/NeonContext';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, Clock, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePOSStore } from '@/stores/posStore';

const IndexContent = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { isLoading } = useNeon();
  const { isTrialActive, trialDaysRemaining, subscription, refreshSubscription } = useAuth();
  const { brand } = usePOSStore();

  // Refresh subscription on mount to get latest data
  useEffect(() => {
    refreshSubscription();
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case 'pos':
        return <POSView onCartOpen={() => setMobileCartOpen(true)} />;
      case 'orders':
        return <OrderHistory />;
      case 'menu':
        return <MenuManager />;
      case 'inventory':
        return <InventoryView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <POSView onCartOpen={() => setMobileCartOpen(true)} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl pos-gradient flex items-center justify-center pos-shadow-lg animate-pulse-soft">
            <span className="text-2xl font-bold text-primary-foreground">
              {brand.name.charAt(0)}
            </span>
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{brand.name} - POS System</title>
        <meta name="description" content="Fast & simple point of sale system for restaurants. Generate bills, manage menu items, and track inventory." />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#f97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </Helmet>
      
      <div className="flex h-screen bg-background overflow-hidden flex-col">
        {/* Trial Banner - only show for trial plans */}
        {isTrialActive && subscription?.plan_name === 'trial' && (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 flex items-center justify-between shrink-0 safe-area-top">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">
                Trial: {trialDaysRemaining}d left
              </span>
            </div>
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-6 text-[10px] px-2"
              onClick={() => setActiveTab('settings')}
            >
              <Crown className="h-3 w-3 mr-1" />
              Upgrade
            </Button>
          </div>
        )}
        
        <div className="flex flex-1 overflow-hidden">
          {/* Desktop Sidebar */}
          <div className="hidden md:block">
            <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
          </div>
          
          {/* Main Content */}
          <main className="flex-1 overflow-hidden pb-16 md:pb-0">
            {renderContent()}
          </main>
        </div>
        
        {/* Mobile Navigation */}
        <MobileNav activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Mobile Cart Button & Sheet */}
        {activeTab === 'pos' && (
          <MobileCart open={mobileCartOpen} onOpenChange={setMobileCartOpen} />
        )}
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
