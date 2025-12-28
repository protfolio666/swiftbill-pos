import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShoppingCart, 
  UtensilsCrossed, 
  Package, 
  Settings,
  ChevronLeft,
  ChevronRight,
  History,
  LogOut,
  Shield,
  ChefHat,
  ClipboardList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { usePOSStore } from '@/stores/posStore';
import { StaffRole } from '@/types/kot';

interface SidebarProps {
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

const ADMIN_EMAIL = 'bsnlsdp3600@gmail.com';

export function Sidebar({ activeTab, onTabChange, role, isKOTEnabled, permissions }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { brand } = usePOSStore();
  const { signOut, profile, user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
  };

  // Build nav items based on role and KOT status
  const getNavItems = () => {
    // Chef-specific navigation
    if (isKOTEnabled && role === 'chef') {
      return [
        { id: 'chef', label: 'Kitchen', icon: ChefHat },
        { id: 'settings', label: 'Settings', icon: Settings },
      ];
    }

    // Waiter-specific navigation
    if (isKOTEnabled && role === 'waiter') {
      return [
        { id: 'pos', label: 'POS', icon: ShoppingCart },
        { id: 'waiter', label: 'My Orders', icon: ClipboardList },
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
      { id: 'inventory', label: 'Inventory', icon: Package },
      { id: 'settings', label: 'Settings', icon: Settings }
    );

    return items;
  };

  const navItems = getNavItems();

  return (
    <aside
      className={cn(
        "flex flex-col bg-card border-r border-border transition-all duration-300 h-full",
        collapsed ? "w-[72px]" : "w-56"
      )}
    >
      {/* Logo/Brand */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl pos-gradient flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0 pos-shadow">
            {brand.logo ? (
              <img src={brand.logo} alt={brand.name} className="w-9 h-9 object-contain rounded-lg" />
            ) : (
              brand.name.charAt(0)
            )}
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden flex-1 min-w-0">
              <h1 className="font-bold text-foreground truncate text-sm">{profile?.restaurant_name || brand.name}</h1>
              <p className="text-[10px] text-muted-foreground truncate">
                {role && isKOTEnabled ? (
                  <span className="capitalize">{role}</span>
                ) : (
                  profile?.owner_name || 'POS System'
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
                isActive
                  ? "pos-gradient text-primary-foreground pos-shadow"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="font-medium text-sm animate-fade-in">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* Admin Link - Only visible to admin */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-purple-500 hover:bg-purple-500/10"
          >
            <Shield className="w-5 h-5 shrink-0" />
            {!collapsed && (
              <span className="font-medium text-sm animate-fade-in">Admin</span>
            )}
          </button>
        )}
      </nav>

      {/* Logout and Collapse */}
      <div className="p-2 border-t border-border space-y-1">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!collapsed && <span className="text-sm font-medium">Logout</span>}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!collapsed && <span className="text-sm">Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
