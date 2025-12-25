import { useCallback, useEffect, useState, useRef } from 'react';
import { usePOSStore, resetPOSStore } from '@/stores/posStore';
import * as neonApi from '@/services/neonApi';
import { toast } from 'sonner';
import { MenuItem, Category, Order } from '@/types/pos';
import { useAuth } from '@/contexts/AuthContext';

export function useNeonSync() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const { user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);

  const setCategories = usePOSStore((state) => state.setCategories);
  const setMenuItems = usePOSStore((state) => state.setMenuItems);
  const setOrders = usePOSStore((state) => state.setOrders);
  const setBrand = usePOSStore((state) => state.setBrand);
  const addCategoryLocal = usePOSStore((state) => state.addCategory);
  const deleteCategoryLocal = usePOSStore((state) => state.deleteCategory);
  const addMenuItemLocal = usePOSStore((state) => state.addMenuItem);
  const updateMenuItemLocal = usePOSStore((state) => state.updateMenuItem);
  const deleteMenuItemLocal = usePOSStore((state) => state.deleteMenuItem);

  const syncFromNeon = useCallback(async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch categories
      const categoriesResult = await neonApi.getCategories();
      if (categoriesResult.data) {
        const categories = categoriesResult.data.map(cat => ({
          id: String(cat.id),
          name: cat.name,
          icon: '📦',
        }));
        setCategories(categories.length > 0 ? categories : []);
      }

      // Fetch menu items
      const menuItemsResult = await neonApi.getMenuItems();
      if (menuItemsResult.data) {
        const categoriesData = (await neonApi.getCategories()).data || [];
        const categoryMap = new Map(categoriesData.map(c => [c.id, c.name]));
        
        const menuItems = menuItemsResult.data.map(item => ({
          id: String(item.id),
          name: item.name,
          price: Number(item.price),
          category: item.category_id ? categoryMap.get(item.category_id) || 'Uncategorized' : 'Uncategorized',
          stock: item.stock,
          image: item.image_url || undefined,
        }));
        setMenuItems(menuItems);
      }

      // Fetch orders
      const ordersResult = await neonApi.getOrders();
      if (ordersResult.data) {
        const orders = ordersResult.data.map(order => ({
          id: `ORD-${order.id}`,
          items: order.items as any[],
          subtotal: Number(order.total),
          discount: 0,
          discountType: 'percentage' as const,
          cgst: 0,
          sgst: 0,
          total: Number(order.total),
          date: new Date(order.created_at),
          status: order.status as 'pending' | 'completed' | 'cancelled',
          orderType: 'dine-in' as const,
        }));
        setOrders(orders);
      }

      // Fetch brand settings
      const brandResult = await neonApi.getBrandSettings();
      if (brandResult.data && brandResult.data.length > 0) {
        const brand = brandResult.data[0];
        setBrand({
          name: brand.business_name,
          currency: brand.currency === 'USD' ? '$' : brand.currency === 'INR' ? '₹' : brand.currency,
          logo: brand.logo_url || undefined,
        });
      }

      setIsSynced(true);
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync with database');
    } finally {
      setIsLoading(false);
    }
  }, [user, setCategories, setMenuItems, setOrders, setBrand]);

  // Reset and resync when user changes
  useEffect(() => {
    const currentUserId = user?.id || null;
    
    if (previousUserIdRef.current !== currentUserId) {
      // User changed - reset store and resync
      if (previousUserIdRef.current !== null) {
        // Only reset if there was a previous user (not initial load)
        resetPOSStore();
      }
      previousUserIdRef.current = currentUserId;
      
      if (currentUserId) {
        syncFromNeon();
      } else {
        setIsLoading(false);
        setIsSynced(false);
      }
    }
  }, [user?.id, syncFromNeon]);

  // Save category to Neon
  const addCategory = useCallback(async (name: string, icon: string) => {
    try {
      const result = await neonApi.createCategory(name, '#3B82F6');
      if (result.data && result.data.length > 0) {
        const newCat = result.data[0];
        addCategoryLocal({ id: String(newCat.id), name: newCat.name, icon });
        toast.success('Category added');
        return true;
      }
      throw new Error(result.error || 'Failed to create category');
    } catch (error) {
      toast.error('Failed to add category');
      return false;
    }
  }, [addCategoryLocal]);

  // Delete category from Neon
  const deleteCategory = useCallback(async (id: string) => {
    try {
      await neonApi.deleteCategory(Number(id));
      deleteCategoryLocal(id);
      toast.success('Category deleted');
      return true;
    } catch (error) {
      toast.error('Failed to delete category');
      return false;
    }
  }, [deleteCategoryLocal]);

  // Save menu item to Neon
  const addMenuItem = useCallback(async (item: Omit<MenuItem, 'id'>, categoryId: number | null) => {
    try {
      const result = await neonApi.createMenuItem({
        name: item.name,
        price: item.price,
        category_id: categoryId,
        image_url: item.image || null,
        stock: item.stock,
      });
      if (result.data && result.data.length > 0) {
        const newItem = result.data[0];
        addMenuItemLocal({
          id: String(newItem.id),
          name: newItem.name,
          price: Number(newItem.price),
          category: item.category,
          stock: newItem.stock,
          image: newItem.image_url || undefined,
        });
        toast.success('Menu item added');
        return true;
      }
      throw new Error(result.error || 'Failed to create menu item');
    } catch (error) {
      toast.error('Failed to add menu item');
      return false;
    }
  }, [addMenuItemLocal]);

  // Update menu item in Neon
  const updateMenuItem = useCallback(async (id: string, item: Partial<MenuItem>, categoryId: number | null) => {
    try {
      const result = await neonApi.updateMenuItem({
        id: Number(id),
        name: item.name!,
        price: item.price!,
        category_id: categoryId,
        image_url: item.image || null,
        stock: item.stock,
      });
      if (result.data) {
        updateMenuItemLocal(id, item);
        toast.success('Menu item updated');
        return true;
      }
      throw new Error(result.error || 'Failed to update menu item');
    } catch (error) {
      toast.error('Failed to update menu item');
      return false;
    }
  }, [updateMenuItemLocal]);

  // Delete menu item from Neon
  const deleteMenuItem = useCallback(async (id: string) => {
    try {
      await neonApi.deleteMenuItem(Number(id));
      deleteMenuItemLocal(id);
      toast.success('Menu item deleted');
      return true;
    } catch (error) {
      toast.error('Failed to delete menu item');
      return false;
    }
  }, [deleteMenuItemLocal]);

  // Save order to Neon
  const saveOrder = useCallback(async (order: Order) => {
    try {
      await neonApi.createOrder({
        items: order.items,
        total: order.total,
        payment_method: 'cash',
        status: order.status,
      });
      return true;
    } catch (error) {
      console.error('Failed to save order to Neon:', error);
      return false;
    }
  }, []);

  // Save brand settings to Neon
  const saveBrandSettings = useCallback(async (settings: { name: string; currency: string; logo?: string }) => {
    try {
      const currencyCode = settings.currency === '₹' ? 'INR' : settings.currency === '$' ? 'USD' : settings.currency;
      await neonApi.updateBrandSettings({
        business_name: settings.name,
        logo_url: settings.logo || null,
        currency: currencyCode,
      });
      toast.success('Settings saved to database');
      return true;
    } catch (error) {
      console.error('Failed to save settings to Neon:', error);
      toast.error('Failed to save settings to database');
      return false;
    }
  }, []);

  return { 
    isLoading, 
    isSynced, 
    refresh: syncFromNeon,
    addCategory,
    deleteCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    saveOrder,
    saveBrandSettings,
  };
}
