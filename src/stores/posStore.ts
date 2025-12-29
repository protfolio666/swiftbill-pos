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
  customerName: string;
  customerPhone: string;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (num: number | null) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;

  // Orders
  orders: Order[];
  lastOrder: Order | null;
  setOrders: (orders: Order[]) => void;
  setLastOrder: (order: Order | null) => void;
  createOrder: () => Order | null;
}

const defaultBrand: BrandSettings = {
  name: 'My Restaurant',
  currency: '₹',
  taxRate: 5,
  enableGST: true,
  cgstRate: 2.5,
  sgstRate: 2.5,
  upiId: '',
  gstin: '',
  showGstOnReceipt: false,
  zapierWebhookUrl: '',
  enableAutoWhatsApp: false,
};

// Get the current user ID from localStorage to make storage user-specific
const getUserStorageKey = () => {
  const userDataStr = localStorage.getItem('sb-nptoxwmbsxefhqjcxjhg-auth-token');
  if (userDataStr) {
    try {
      const userData = JSON.parse(userDataStr);
      if (userData?.user?.id) {
        return `pos-storage-${userData.user.id}`;
      }
    } catch {
      // If parsing fails, use default key
    }
  }
  return 'pos-storage';
};

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      brand: defaultBrand,
      setBrand: (brand) => set((state) => ({ brand: { ...state.brand, ...brand } })),

      menuItems: [], // Start empty - data comes from Neon per user
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

      categories: [], // Start empty - data comes from Neon per user
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
      clearCart: () => set({ cart: [], discount: 0, discountType: 'percentage', orderType: 'dine-in', tableNumber: null, customerName: '', customerPhone: '' }),

      discount: 0,
      discountType: 'percentage',
      setDiscount: (amount, type) => set({ discount: amount, discountType: type }),

      orderType: 'dine-in',
      tableNumber: null,
      customerName: '',
      customerPhone: '',
      setOrderType: (type) => set({ orderType: type }),
      setTableNumber: (num) => set({ tableNumber: num }),
      setCustomerName: (name) => set({ customerName: name }),
      setCustomerPhone: (phone) => set({ customerPhone: phone }),

      orders: [], // Start empty - data comes from Neon per user
      lastOrder: null,
      setOrders: (orders) => set({ orders }),
      setLastOrder: (order) => set({ lastOrder: order }),
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
          customerName: state.customerName || undefined,
          customerPhone: state.customerPhone || undefined,
        };

        // Update stock
        state.cart.forEach((cartItem) => {
          const menuItem = state.menuItems.find((m) => m.id === cartItem.id);
          if (menuItem) {
            state.updateMenuItem(cartItem.id, {
              stock: menuItem.stock - cartItem.quantity,
            });
          }
        });

        set((s) => ({ 
          orders: [order, ...s.orders],
          lastOrder: order,
          cart: [], 
          discount: 0, 
          discountType: 'percentage',
          orderType: 'dine-in',
          tableNumber: null,
          customerName: '',
          customerPhone: '',
        }));
        return order;
      },
    }),
    {
      name: getUserStorageKey(),
    }
  )
);

// Function to reset store for new user
export const resetPOSStore = () => {
  usePOSStore.setState({
    brand: defaultBrand,
    menuItems: [],
    categories: [],
    cart: [],
    discount: 0,
    discountType: 'percentage',
    orderType: 'dine-in',
    tableNumber: null,
    customerName: '',
    customerPhone: '',
    orders: [],
    lastOrder: null,
  });
};
