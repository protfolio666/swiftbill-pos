import { useCallback, useEffect, useState, useRef } from 'react';
import { usePOSStore, resetPOSStore } from '@/stores/posStore';
import * as neonApi from '@/services/neonApi';
import * as offlineCache from '@/services/offlineCache';
import { toast } from 'sonner';
import { MenuItem, Category, Order } from '@/types/pos';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Global flag to prevent multiple sync hooks from running simultaneously
let globalSyncLock = false;
let lastSyncUserId: string | null = null;

export function useNeonSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [effectiveUserId, setEffectiveUserId] = useState<string | null>(null);
  const { user } = useAuth();
  const previousUserIdRef = useRef<string | null>(null);
  const syncInProgressRef = useRef(false);
  const initialLoadDoneRef = useRef(false);
  const hasLoadedCacheRef = useRef(false);

  const setCategories = usePOSStore((state) => state.setCategories);
  const setMenuItems = usePOSStore((state) => state.setMenuItems);
  const setOrders = usePOSStore((state) => state.setOrders);
  const setBrand = usePOSStore((state) => state.setBrand);
  const addCategoryLocal = usePOSStore((state) => state.addCategory);
  const deleteCategoryLocal = usePOSStore((state) => state.deleteCategory);
  const addMenuItemLocal = usePOSStore((state) => state.addMenuItem);
  const updateMenuItemLocal = usePOSStore((state) => state.updateMenuItem);
  const deleteMenuItemLocal = usePOSStore((state) => state.deleteMenuItem);

  // Fetch effective user ID (owner_id for staff, own id for owners)
  useEffect(() => {
    if (!user) {
      setEffectiveUserId(null);
      return;
    }

    const fetchEffectiveUserId = async () => {
      const { data: staffData } = await supabase
        .from('staff_members')
        .select('owner_id, role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (staffData && staffData.role !== 'owner') {
        // Staff member - use owner's ID for data access
        setEffectiveUserId(staffData.owner_id);
        console.log('Staff user, using owner_id for data:', staffData.owner_id);
      } else {
        // Owner or new user - use own ID
        setEffectiveUserId(user.id);
      }
    };

    fetchEffectiveUserId();
  }, [user]);

  // Check if we already have data in the store (from zustand persistence or previous load)
  const hasExistingData = useCallback(() => {
    const state = usePOSStore.getState();
    return state.menuItems.length > 0 || state.categories.length > 0;
  }, []);

  // Load data from cache immediately (no loading state shown to user)
  const loadFromCacheImmediate = useCallback((userId: string) => {
    // Skip if we already have data and same user
    if (hasExistingData() && lastSyncUserId === userId) {
      hasLoadedCacheRef.current = true;
      setIsSynced(true);
      return true;
    }

    const cachedCategories = offlineCache.loadFromCache<Category[]>('categories', userId);
    const cachedMenuItems = offlineCache.loadFromCache<MenuItem[]>('menuItems', userId);
    const cachedOrders = offlineCache.loadFromCache<Order[]>('orders', userId);
    const cachedBrand = offlineCache.loadFromCache<any>('brandSettings', userId);

    if (cachedCategories?.data) {
      setCategories(cachedCategories.data);
    }
    if (cachedMenuItems?.data) {
      setMenuItems(cachedMenuItems.data);
    }
    if (cachedOrders?.data) {
      setOrders(cachedOrders.data);
    }
    if (cachedBrand?.data) {
      setBrand(cachedBrand.data);
    }

    hasLoadedCacheRef.current = true;
    lastSyncUserId = userId;

    // Check if cache is still valid
    const lastSync = offlineCache.getLastSyncTime(userId);
    if (lastSync && offlineCache.isCacheValid(lastSync)) {
      setIsSynced(true);
      return true; // Cache is valid
    }
    return false; // Cache expired or doesn't exist
  }, [setCategories, setMenuItems, setOrders, setBrand, hasExistingData]);

  // Background sync from Neon (silent - no loading indicators)
  const syncFromNeonSilent = useCallback(async (force = false) => {
    if (!user || !effectiveUserId) return;
    
    // Use global lock to prevent multiple tabs/components from syncing
    if (globalSyncLock && !force) return;
    if (syncInProgressRef.current && !force) return;
    
    // Skip sync if we recently synced (within 30 seconds) and have data
    if (!force && hasExistingData()) {
      const lastSync = offlineCache.getLastSyncTime(effectiveUserId);
      if (lastSync && Date.now() - lastSync < 30000) {
        return; // Synced less than 30 seconds ago
      }
    }

    if (!navigator.onLine) {
      const lastSync = offlineCache.getLastSyncTime(effectiveUserId);
      if (lastSync && !offlineCache.isCacheValid(lastSync)) {
        setSyncError('Offline cache expired. Connect to internet to sync.');
      }
      return;
    }

    globalSyncLock = true;
    syncInProgressRef.current = true;
    setSyncError(null);

    try {
      // Fetch all data in parallel
      const [categoriesResult, menuItemsResult, ordersResult, brandResult] = await Promise.all([
        neonApi.getCategories(),
        neonApi.getMenuItems(),
        neonApi.getOrders(),
        neonApi.getBrandSettings(),
      ]);

      // Process categories
      let categories: Category[] = [];
      if (categoriesResult.data) {
        categories = categoriesResult.data.map(cat => ({
          id: String(cat.id),
          name: cat.name,
          icon: '📦',
        }));
        setCategories(categories);
        offlineCache.saveToCache('categories', categories, effectiveUserId);
      }

      // Process menu items
      if (menuItemsResult.data) {
        const categoryMap = new Map(categories.map(c => [c.id, c.name]));
        const menuItems = menuItemsResult.data.map(item => ({
          id: String(item.id),
          name: item.name,
          price: Number(item.price),
          category: item.category_id ? categoryMap.get(String(item.category_id)) || 'Uncategorized' : 'Uncategorized',
          stock: item.stock,
          image: item.image_url || undefined,
        }));
        setMenuItems(menuItems);
        offlineCache.saveToCache('menuItems', menuItems, effectiveUserId);
      }

      // Process orders
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
          orderType: (order.order_type as 'dine-in' | 'takeaway' | 'delivery') || 'dine-in',
          customerName: order.customer_name || undefined,
          customerPhone: order.customer_phone || undefined,
          tableNumber: order.table_number || undefined,
        }));
        setOrders(orders);
        offlineCache.saveToCache('orders', orders, effectiveUserId);
      }

      // Process brand settings
      if (brandResult.data && brandResult.data.length > 0) {
        const brand = brandResult.data[0];
        const brandSettings = {
          name: brand.business_name,
          currency: brand.currency === 'USD' ? '$' : brand.currency === 'INR' ? '₹' : brand.currency,
          logo: brand.logo_url || undefined,
          upiId: brand.upi_id || '',
          taxRate: brand.tax_rate ?? 5,
          enableGST: brand.enable_gst ?? true,
          cgstRate: brand.cgst_rate ?? 2.5,
          sgstRate: brand.sgst_rate ?? 2.5,
          gstin: brand.gstin || '',
          showGstOnReceipt: brand.show_gst_on_receipt ?? false,
        };
        setBrand(brandSettings);
        offlineCache.saveToCache('brandSettings', brandSettings, effectiveUserId);
      }

      // Mark sync complete
      offlineCache.setLastSyncTime(effectiveUserId);
      setIsSynced(true);
    } catch (error) {
      console.error('Background sync error:', error);
      // Don't show error toast for background sync - just log it
    } finally {
      syncInProgressRef.current = false;
      globalSyncLock = false;
    }
  }, [user, effectiveUserId, setCategories, setMenuItems, setOrders, setBrand, hasExistingData]);

  // Network status listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
      // Sync when coming back online (force it)
      syncFromNeonSilent(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncFromNeonSilent]);

  // Periodic background sync every 5 minutes when online
  useEffect(() => {
    if (!user || !isOnline) return;

    const syncInterval = setInterval(() => {
      syncFromNeonSilent();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(syncInterval);
  }, [user, isOnline, syncFromNeonSilent]);

  // Initial load: cache first, then background sync ONLY if needed
  useEffect(() => {
    // Wait for effectiveUserId to be determined
    if (!effectiveUserId) return;
    
    const currentUserId = effectiveUserId;
    
    // Only do anything if user changed
    if (previousUserIdRef.current === currentUserId && initialLoadDoneRef.current) {
      return; // Same user, already loaded - do nothing
    }

    if (previousUserIdRef.current !== currentUserId) {
      // User changed - reset store only if there was a previous user
      if (previousUserIdRef.current !== null && currentUserId !== null) {
        resetPOSStore();
        hasLoadedCacheRef.current = false;
      }
      previousUserIdRef.current = currentUserId;
      initialLoadDoneRef.current = false;
      
      if (currentUserId) {
        // Step 1: Load from cache immediately (no loading shown)
        const cacheValid = loadFromCacheImmediate(currentUserId);
        initialLoadDoneRef.current = true;
        
        // Step 2: Background sync if online and cache is not fresh
        if (navigator.onLine && !cacheValid) {
          syncFromNeonSilent();
        } else if (!navigator.onLine && !cacheValid) {
          setSyncError('No internet connection. Some data may be outdated.');
        }
      }
    }
  }, [effectiveUserId, loadFromCacheImmediate, syncFromNeonSilent]);

  // Save category to Neon
  const addCategory = useCallback(async (name: string, icon: string) => {
    // Optimistic update
    const tempId = `temp-${Date.now()}`;
    addCategoryLocal({ id: tempId, name, icon });

    if (!navigator.onLine) {
      toast.success('Category added (will sync when online)');
      return true;
    }

    try {
      const result = await neonApi.createCategory(name, '#3B82F6');
      if (result.data && result.data.length > 0) {
        const newCat = result.data[0];
        // Replace temp with real
        deleteCategoryLocal(tempId);
        addCategoryLocal({ id: String(newCat.id), name: newCat.name, icon });
        toast.success('Category added');
        return true;
      }
      throw new Error(result.error || 'Failed to create category');
    } catch (error) {
      deleteCategoryLocal(tempId);
      toast.error('Failed to add category');
      return false;
    }
  }, [addCategoryLocal, deleteCategoryLocal]);

  // Delete category from Neon
  const deleteCategory = useCallback(async (id: string) => {
    // Optimistic update
    const categories = usePOSStore.getState().categories;
    const categoryToDelete = categories.find(c => c.id === id);
    deleteCategoryLocal(id);

    if (!navigator.onLine) {
      toast.success('Category deleted (will sync when online)');
      return true;
    }

    try {
      await neonApi.deleteCategory(Number(id));
      toast.success('Category deleted');
      return true;
    } catch (error) {
      // Rollback
      if (categoryToDelete) addCategoryLocal(categoryToDelete);
      toast.error('Failed to delete category');
      return false;
    }
  }, [deleteCategoryLocal, addCategoryLocal]);

  // Save menu item to Neon
  const addMenuItem = useCallback(async (item: Omit<MenuItem, 'id'>, categoryId: number | null) => {
    const tempId = `temp-${Date.now()}`;
    const tempItem = { ...item, id: tempId };
    addMenuItemLocal(tempItem);

    if (!navigator.onLine) {
      toast.success('Menu item added (will sync when online)');
      return true;
    }

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
        deleteMenuItemLocal(tempId);
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
      deleteMenuItemLocal(tempId);
      toast.error('Failed to add menu item');
      return false;
    }
  }, [addMenuItemLocal, deleteMenuItemLocal]);

  // Update menu item in Neon
  const updateMenuItem = useCallback(async (id: string, item: Partial<MenuItem>, categoryId: number | null) => {
    const menuItems = usePOSStore.getState().menuItems;
    const originalItem = menuItems.find(m => m.id === id);
    updateMenuItemLocal(id, item);

    if (!navigator.onLine) {
      toast.success('Menu item updated (will sync when online)');
      return true;
    }

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
        toast.success('Menu item updated');
        return true;
      }
      throw new Error(result.error || 'Failed to update menu item');
    } catch (error) {
      // Rollback
      if (originalItem) updateMenuItemLocal(id, originalItem);
      toast.error('Failed to update menu item');
      return false;
    }
  }, [updateMenuItemLocal]);

  // Delete menu item from Neon
  const deleteMenuItem = useCallback(async (id: string) => {
    const menuItems = usePOSStore.getState().menuItems;
    const itemToDelete = menuItems.find(m => m.id === id);
    deleteMenuItemLocal(id);

    if (!navigator.onLine) {
      toast.success('Menu item deleted (will sync when online)');
      return true;
    }

    try {
      await neonApi.deleteMenuItem(Number(id));
      toast.success('Menu item deleted');
      return true;
    } catch (error) {
      if (itemToDelete) addMenuItemLocal(itemToDelete);
      toast.error('Failed to delete menu item');
      return false;
    }
  }, [deleteMenuItemLocal, addMenuItemLocal]);

  // Save order to Neon
  const saveOrder = useCallback(async (order: Order) => {
    // Order already added to local store, just sync to server
    if (!navigator.onLine) {
      // Queue for later sync
      return true;
    }

    try {
      await neonApi.createOrder({
        items: order.items,
        total: order.total,
        payment_method: 'cash',
        status: order.status,
        customer_name: order.customerName || null,
        customer_phone: order.customerPhone || null,
        order_type: order.orderType || null,
        table_number: order.tableNumber || null,
      });
      return true;
    } catch (error) {
      console.error('Failed to save order to Neon:', error);
      return false;
    }
  }, []);

  // Save brand settings to Neon
  const saveBrandSettings = useCallback(async (settings: { 
    name: string; 
    currency: string; 
    logo?: string;
    upiId?: string;
    taxRate?: number;
    enableGST?: boolean;
    cgstRate?: number;
    sgstRate?: number;
    gstin?: string;
    showGstOnReceipt?: boolean;
  }) => {
    setBrand(settings);
    
    if (user) {
      offlineCache.saveToCache('brandSettings', settings, user.id);
    }

    if (!navigator.onLine) {
      toast.success('Settings saved (will sync when online)');
      return true;
    }

    try {
      const currencyCode = settings.currency === '₹' ? 'INR' : settings.currency === '$' ? 'USD' : settings.currency;
      await neonApi.updateBrandSettings({
        business_name: settings.name,
        logo_url: settings.logo || null,
        currency: currencyCode,
        upi_id: settings.upiId || null,
        tax_rate: settings.taxRate,
        enable_gst: settings.enableGST,
        cgst_rate: settings.cgstRate,
        sgst_rate: settings.sgstRate,
        gstin: settings.gstin || null,
        show_gst_on_receipt: settings.showGstOnReceipt,
      });
      return true;
    } catch (error) {
      console.error('Failed to save settings to Neon:', error);
      toast.error('Failed to save settings to server');
      return false;
    }
  }, [setBrand, user]);

  // Manual refresh function (for pull-to-refresh etc.)
  const refresh = useCallback(async () => {
    if (!navigator.onLine) {
      toast.error('No internet connection');
      return;
    }
    setIsLoading(true);
    await syncFromNeonSilent(true); // Force sync
    setIsLoading(false);
    toast.success('Data refreshed');
  }, [syncFromNeonSilent]);

  return { 
    isLoading, 
    isSynced,
    isOnline,
    syncError,
    refresh,
    addCategory,
    deleteCategory,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    saveOrder,
    saveBrandSettings,
  };
}