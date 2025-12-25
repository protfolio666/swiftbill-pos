import { supabase } from '@/integrations/supabase/client';

const FUNCTION_URL = `https://nptoxwmbsxefhqjcxjhg.supabase.co/functions/v1/neon-db`;

interface NeonResponse<T> {
  data?: T;
  error?: string;
}

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function callNeonFunction<T>(action: string, data?: object): Promise<NeonResponse<T>> {
  try {
    const token = await getAuthToken();
    
    if (!token) {
      return { error: 'Not authenticated' };
    }

    const response = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action, data }),
    });

    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Request failed');
    }

    return result;
  } catch (error) {
    console.error('Neon API error:', error);
    return { error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Categories
export const getCategories = () => callNeonFunction<DbCategory[]>('getCategories');
export const createCategory = (name: string, color: string) => 
  callNeonFunction<DbCategory[]>('createCategory', { name, color });
export const deleteCategory = (id: number) => 
  callNeonFunction('deleteCategory', { id });

// Menu Items
export const getMenuItems = () => callNeonFunction<DbMenuItem[]>('getMenuItems');
export const createMenuItem = (item: CreateMenuItemInput) => 
  callNeonFunction<DbMenuItem[]>('createMenuItem', item);
export const updateMenuItem = (item: UpdateMenuItemInput) => 
  callNeonFunction<DbMenuItem[]>('updateMenuItem', item);
export const deleteMenuItem = (id: number) => 
  callNeonFunction('deleteMenuItem', { id });

// Orders
export const getOrders = () => callNeonFunction<DbOrder[]>('getOrders');
export const createOrder = (order: CreateOrderInput) => 
  callNeonFunction<DbOrder[]>('createOrder', order);

// Brand Settings
export const getBrandSettings = () => callNeonFunction<DbBrandSettings[]>('getBrandSettings');
export const updateBrandSettings = (settings: UpdateBrandSettingsInput) => 
  callNeonFunction<DbBrandSettings[]>('updateBrandSettings', settings);

// Types for DB records
export interface DbCategory {
  id: number;
  name: string;
  color: string;
  user_id: string;
  created_at: string;
}

export interface DbMenuItem {
  id: number;
  name: string;
  price: number;
  category_id: number | null;
  image_url: string | null;
  stock: number;
  user_id: string;
  created_at: string;
}

export interface DbOrder {
  id: number;
  items: unknown;
  total: number;
  payment_method: string;
  status: string;
  user_id: string;
  created_at: string;
}

export interface DbBrandSettings {
  id: number;
  business_name: string;
  logo_url: string | null;
  primary_color: string;
  currency: string;
  user_id: string;
  created_at: string;
}

export interface CreateMenuItemInput {
  name: string;
  price: number;
  category_id: number | null;
  image_url?: string | null;
  stock?: number;
}

export interface UpdateMenuItemInput extends CreateMenuItemInput {
  id: number;
}

export interface CreateOrderInput {
  items: unknown;
  total: number;
  payment_method: string;
  status?: string;
}

export interface UpdateBrandSettingsInput {
  business_name: string;
  logo_url?: string | null;
  primary_color?: string;
  currency?: string;
}
