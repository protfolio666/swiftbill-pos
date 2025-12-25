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

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  date: Date;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface BrandSettings {
  name: string;
  logo?: string;
  currency: string;
  taxRate: number;
}

export type Category = {
  id: string;
  name: string;
  icon: string;
};
