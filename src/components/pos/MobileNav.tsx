import { ShoppingCart, UtensilsCrossed, Package, Settings, History, ChefHat, ClipboardList, LogOut, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StaffRole } from '@/types/kot';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

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
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
  };

  // Build nav items based on role and KOT status
  const getNavItems = () => {
    // Chef-specific navigation - ONLY kitchen, NO settings
    if (role === 'chef') {
      return [
        { id: 'chef', label: 'Kitchen', icon: ChefHat },
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
    );

    return items;
  };

  const navItems = getNavItems();

  // Show settings in "More" menu for owners/managers only
  const showSettingsInMore = role !== 'chef' && role !== 'waiter';

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

        {/* More Menu with Settings and Logout */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all min-w-[60px]",
                activeTab === 'settings' ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "p-1.5 rounded-xl transition-all",
                activeTab === 'settings' && "pos-gradient pos-shadow"
              )}>
                <MoreHorizontal className={cn(
                  "w-5 h-5",
                  activeTab === 'settings' && "text-primary-foreground"
                )} />
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-0.5",
                activeTab === 'settings' && "text-primary"
              )}>
                More
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 mb-2">
            {showSettingsInMore && (
              <>
                <DropdownMenuItem onClick={() => onTabChange('inventory')}>
                  <Package className="w-4 h-4 mr-2" />
                  Inventory
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onTabChange('settings')}>
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem 
              onClick={handleLogout}
              className="text-red-600 focus:text-red-600"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
