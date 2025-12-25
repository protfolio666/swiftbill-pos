import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MenuItem, CartItem, Order, BrandSettings, Category, OrderType } from '@/types/pos';

interface POSState {
  // Brand Settings
  brand: BrandSettings;
  setBrand: (brand: Partial<BrandSettings>) => void;

  // Menu Items
  menuItems: MenuItem[];
  setMenuItems: (items: MenuItem[]) => void;
  addMenuItem: (item: MenuItem) => void;
  updateMenuItem: (id: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (id: string) => void;

  // Categories
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  addCategory: (category: Category) => void;
  deleteCategory: (id: string) => void;

  // Cart
  cart: CartItem[];
  addToCart: (item: MenuItem) => void;
  removeFromCart: (id: string) => void;
  updateCartQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;

  // Discount
  discount: number;
  discountType: 'percentage' | 'fixed';
  setDiscount: (amount: number, type: 'percentage' | 'fixed') => void;

  // Order Options
  orderType: OrderType;
  tableNumber: number | null;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (num: number | null) => void;

  // Orders
  orders: Order[];
  setOrders: (orders: Order[]) => void;
  createOrder: () => Order | null;
}

const defaultCategories: Category[] = [
  { id: '1', name: 'Starters', icon: '🥗' },
  { id: '2', name: 'Main Course', icon: '🍛' },
  { id: '3', name: 'Beverages', icon: '🥤' },
  { id: '4', name: 'Desserts', icon: '🍰' },
];

const defaultMenuItems: MenuItem[] = [
  { id: '1', name: 'Caesar Salad', price: 12.99, category: 'Starters', stock: 50 },
  { id: '2', name: 'Tomato Soup', price: 8.99, category: 'Starters', stock: 30 },
  { id: '3', name: 'Grilled Chicken', price: 18.99, category: 'Main Course', stock: 25 },
  { id: '4', name: 'Pasta Carbonara', price: 16.99, category: 'Main Course', stock: 40 },
  { id: '5', name: 'Fresh Lemonade', price: 4.99, category: 'Beverages', stock: 100 },
  { id: '6', name: 'Iced Coffee', price: 5.99, category: 'Beverages', stock: 80 },
  { id: '7', name: 'Chocolate Cake', price: 7.99, category: 'Desserts', stock: 20 },
  { id: '8', name: 'Ice Cream', price: 5.99, category: 'Desserts', stock: 45 },
];

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      brand: {
        name: 'My Restaurant',
        currency: '₹',
        taxRate: 5,
        enableGST: true,
        cgstRate: 2.5,
        sgstRate: 2.5,
        upiId: '',
      },
      setBrand: (brand) => set((state) => ({ brand: { ...state.brand, ...brand } })),

      menuItems: defaultMenuItems,
      setMenuItems: (items) => set({ menuItems: items }),
      addMenuItem: (item) => set((state) => ({ menuItems: [...state.menuItems, item] })),
      updateMenuItem: (id, updates) =>
        set((state) => ({
          menuItems: state.menuItems.map((item) =>
            item.id === id ? { ...item, ...updates } : item
          ),
        })),
      deleteMenuItem: (id) =>
        set((state) => ({ menuItems: state.menuItems.filter((item) => item.id !== id) })),

      categories: defaultCategories,
      setCategories: (categories) => set({ categories }),
      addCategory: (category) => set((state) => ({ categories: [...state.categories, category] })),
      deleteCategory: (id) =>
        set((state) => ({ categories: state.categories.filter((cat) => cat.id !== id) })),

      cart: [],
      addToCart: (item) =>
        set((state) => {
          const existingItem = state.cart.find((cartItem) => cartItem.id === item.id);
          if (existingItem) {
            return {
              cart: state.cart.map((cartItem) =>
                cartItem.id === item.id
                  ? { ...cartItem, quantity: cartItem.quantity + 1 }
                  : cartItem
              ),
            };
          }
          return { cart: [...state.cart, { ...item, quantity: 1 }] };
        }),
      removeFromCart: (id) =>
        set((state) => ({ cart: state.cart.filter((item) => item.id !== id) })),
      updateCartQuantity: (id, quantity) =>
        set((state) => ({
          cart:
            quantity <= 0
              ? state.cart.filter((item) => item.id !== id)
              : state.cart.map((item) =>
                  item.id === id ? { ...item, quantity } : item
                ),
        })),
      clearCart: () => set({ cart: [], discount: 0, discountType: 'percentage', orderType: 'dine-in', tableNumber: null }),

      discount: 0,
      discountType: 'percentage',
      setDiscount: (amount, type) => set({ discount: amount, discountType: type }),

      orderType: 'dine-in',
      tableNumber: null,
      setOrderType: (type) => set({ orderType: type }),
      setTableNumber: (num) => set({ tableNumber: num }),

      orders: [],
      setOrders: (orders) => set({ orders }),
      createOrder: () => {
        const state = get();
        if (state.cart.length === 0) return null;

        const subtotal = state.cart.reduce(
          (sum, item) => sum + item.price * item.quantity,
          0
        );
        
        const discountAmount = state.discountType === 'percentage' 
          ? subtotal * (state.discount / 100) 
          : state.discount;
        
        const afterDiscount = subtotal - discountAmount;
        
        let cgst = 0;
        let sgst = 0;
        let tax = 0;
        
        if (state.brand.enableGST) {
          cgst = afterDiscount * (state.brand.cgstRate / 100);
          sgst = afterDiscount * (state.brand.sgstRate / 100);
          tax = cgst + sgst;
        } else {
          tax = afterDiscount * (state.brand.taxRate / 100);
        }
        
        const total = afterDiscount + tax;

        const order: Order = {
          id: `ORD-${Date.now()}`,
          items: [...state.cart],
          subtotal,
          discount: discountAmount,
          discountType: state.discountType,
          cgst,
          sgst,
          total,
          date: new Date(),
          status: 'completed',
          orderType: state.orderType,
          tableNumber: state.orderType === 'dine-in' ? state.tableNumber ?? undefined : undefined,
        };

        // Update stock
        state.cart.forEach((cartItem) => {
          state.updateMenuItem(cartItem.id, {
            stock: state.menuItems.find((m) => m.id === cartItem.id)!.stock - cartItem.quantity,
          });
        });

        set((s) => ({ 
          orders: [order, ...s.orders], 
          cart: [], 
          discount: 0, 
          discountType: 'percentage',
          orderType: 'dine-in',
          tableNumber: null,
        }));
        return order;
      },
    }),
    {
      name: 'pos-storage',
    }
  )
);
