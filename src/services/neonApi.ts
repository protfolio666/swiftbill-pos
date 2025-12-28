import { supabase } from '@/integrations/supabase/client';

interface NeonResponse<T> {
  data?: T;
  error?: string;
}

async function callNeonFunction<T>(action: string, data?: object): Promise<NeonResponse<T>> {
  try {
    const { data: result, error } = await supabase.functions.invoke('neon-db', {
      body: { action, data },
    });

    if (error) {
      return { error: error.message || 'Request failed' };
    }

    return (result ?? {}) as NeonResponse<T>;
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
  customer_name?: string | null;
  customer_phone?: string | null;
  order_type?: string | null;
  table_number?: number | null;
}

export interface DbBrandSettings {
  id: number;
  business_name: string;
  logo_url: string | null;
  primary_color: string;
  currency: string;
  user_id: string;
  created_at: string;
  upi_id?: string | null;
  tax_rate?: number;
  enable_gst?: boolean;
  cgst_rate?: number;
  sgst_rate?: number;
  gstin?: string | null;
  show_gst_on_receipt?: boolean;
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
  customer_name?: string | null;
  customer_phone?: string | null;
  order_type?: string | null;
  table_number?: number | null;
}

export interface UpdateBrandSettingsInput {
  business_name: string;
  logo_url?: string | null;
  primary_color?: string;
  currency?: string;
  upi_id?: string | null;
  tax_rate?: number;
  enable_gst?: boolean;
  cgst_rate?: number;
  sgst_rate?: number;
  gstin?: string | null;
  show_gst_on_receipt?: boolean;
}
