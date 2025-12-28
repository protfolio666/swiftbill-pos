import { ShoppingCart, UtensilsCrossed, Package, Settings, History, ChefHat, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRole } from '@/types/kot';

interface MobileNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  role?: StaffRole | null;
  isKOTEnabled?: boolean;
  permissions?: {
    canViewReports: boolean;
    canManageSettings: boolean;
    canViewKOT: boolean;
    canPlaceOrders: boolean;
  };
}

export function MobileNav({ activeTab, onTabChange, role, isKOTEnabled, permissions }: MobileNavProps) {
  // Build nav items based on role and KOT status
  const getNavItems = () => {
    // Chef-specific navigation
    if (role === 'chef') {
      return [
        { id: 'chef', label: 'Kitchen', icon: ChefHat },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
    }

    // Waiter-specific navigation - NO settings access
    if (role === 'waiter') {
      return [
        { id: 'pos', label: 'POS', icon: ShoppingCart },
        { id: 'waiter', label: 'Orders', icon: ClipboardList },
      ];
    }

    // Owner/Manager navigation
    const items = [
      { id: 'pos', label: 'POS', icon: ShoppingCart },
      { id: 'orders', label: 'Orders', icon: History },
    ];

    // Add KOT tab if enabled
    if (isKOTEnabled && permissions?.canViewKOT) {
      items.push({ id: 'kot', label: 'Kitchen', icon: ChefHat });
    }

    items.push(
      { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
      { id: 'settings', label: 'More', icon: Settings }
    );

    return items;
  };

  const navItems = getNavItems();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around px-2 py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[60px]",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                isActive && "pos-gradient pos-shadow"
              )}>
                <Icon className={cn(
                  "w-5 h-5",
                  isActive && "text-primary-foreground"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-0.5",
                isActive && "text-primary"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
