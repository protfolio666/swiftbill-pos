import { useState } from 'react';
import { Sidebar } from '@/components/pos/Sidebar';
import { MobileNav } from '@/components/pos/MobileNav';
import { MobileCart } from '@/components/pos/MobileCart';
import { POSView } from '@/components/pos/POSView';
import { MenuManager } from '@/components/pos/MenuManager';
import { InventoryView } from '@/components/pos/InventoryView';
import { SettingsView } from '@/components/pos/SettingsView';
import { OrderHistory } from '@/components/pos/OrderHistory';
import { Helmet } from 'react-helmet-async';
import { useNeon } from '@/contexts/NeonContext';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, Crown, WifiOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePOSStore } from '@/stores/posStore';

const Index = () => {
  const [activeTab, setActiveTab] = useState('pos');
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const { isLoading, isOnline, syncError, refresh } = useNeon();
  const { isTrialActive, trialDaysRemaining, subscription } = useAuth();
  const { brand } = usePOSStore();

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
        {/* Offline Banner - subtle indicator */}
        {!isOnline && (
          <div className="bg-muted/80 text-muted-foreground px-3 py-1 flex items-center justify-center gap-2 shrink-0 text-xs">
            <WifiOff className="h-3 w-3" />
            <span>Offline mode - changes will sync when online</span>
          </div>
        )}

        {/* Sync Error Banner */}
        {syncError && isOnline && (
          <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 flex items-center justify-center gap-2 shrink-0 text-xs">
            <span>{syncError}</span>
            <Button variant="ghost" size="sm" className="h-5 px-2 text-xs" onClick={refresh}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        )}

        {/* Background sync indicator - very subtle */}
        {isLoading && isOnline && (
          <div className="absolute top-2 right-2 z-50">
            <div className="flex items-center gap-1.5 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 shadow-sm border">
              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
              <span className="text-[10px] text-muted-foreground">Syncing...</span>
            </div>
          </div>
        )}
        
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

export default Index;
