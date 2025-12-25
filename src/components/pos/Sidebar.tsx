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
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { usePOSStore } from '@/stores/posStore';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const ADMIN_EMAIL = 'bsnlsdp3600@gmail.com';

const navItems = [
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'orders', label: 'Orders', icon: History },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { brand } = usePOSStore();
  const { signOut, profile, user } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.email === ADMIN_EMAIL;

  const handleLogout = async () => {
    await signOut();
    toast.success('Logged out successfully');
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-card border-r border-border transition-all duration-300 h-full",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo/Brand */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl pos-gradient flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
            {brand.logo ? (
              <img src={brand.logo} alt={brand.name} className="w-8 h-8 object-contain" />
            ) : (
              brand.name.charAt(0)
            )}
          </div>
          {!collapsed && (
            <div className="animate-fade-in overflow-hidden">
              <h1 className="font-bold text-foreground truncate">{profile?.restaurant_name || brand.name}</h1>
              <p className="text-xs text-muted-foreground">{profile?.owner_name || 'POS System'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200",
                isActive
                  ? "pos-gradient text-primary-foreground pos-shadow"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && (
                <span className="font-medium animate-fade-in">{item.label}</span>
              )}
            </button>
          );
        })}

        {/* Admin Link - Only visible to admin */}
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 text-purple-500 hover:bg-purple-500/10"
          >
            <Shield className="w-5 h-5 shrink-0" />
            {!collapsed && (
              <span className="font-medium animate-fade-in">Admin</span>
            )}
          </button>
        )}
      </nav>

      {/* Logout and Collapse */}
      <div className="p-3 border-t border-border space-y-1">
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
