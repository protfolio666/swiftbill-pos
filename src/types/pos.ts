export interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  image?: string;
}

export interface CartItem extends MenuItem {
  quantity: number;
}

export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export interface Order {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  discountType: 'percentage' | 'fixed';
  cgst: number;
  sgst: number;
  total: number;
  date: Date;
  status: 'pending' | 'completed' | 'cancelled';
  orderType: OrderType;
  tableNumber?: number;
  customerName?: string;
  customerPhone?: string;
}

export interface BrandSettings {
  name: string;
  logo?: string;
  currency: string;
  taxRate: number;
  enableGST: boolean;
  cgstRate: number;
  sgstRate: number;
  upiId?: string;
  gstin?: string;
  showGstOnReceipt: boolean;
}

export type Category = {
  id: string;
  name: string;
  icon: string;
};
