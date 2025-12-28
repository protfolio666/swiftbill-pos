// KOT (Kitchen Order Ticket) Types

export type StaffRole = 'owner' | 'manager' | 'waiter' | 'chef';
export type ChefStatus = 'online' | 'offline' | 'break';
export type OrderAssignmentMode = 'auto' | 'claim' | 'manual';
export type KOTOrderStatus = 'pending' | 'assigned' | 'preparing' | 'completed' | 'served' | 'cancelled';

export interface StaffMember {
  id: string;
  user_id: string;
  owner_id: string;
  role: StaffRole;
  name: string;
  phone?: string;
  is_active: boolean;
  chef_status: ChefStatus;
  created_at: string;
  updated_at: string;
  // Joined data
  email?: string;
}

export interface KOTSettings {
  id: string;
  owner_id: string;
  kot_enabled: boolean;
  order_assignment_mode: OrderAssignmentMode;
  default_prep_time_minutes: number;
  auto_assign_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface KOTOrder {
  id: string;
  owner_id: string;
  order_id: string;
  waiter_id?: string;
  assigned_chef_id?: string;
  status: KOTOrderStatus;
  items: KOTOrderItem[];
  table_number?: number;
  customer_name?: string;
  prep_time_minutes?: number;
  started_at?: string;
  completed_at?: string;
  served_at?: string;
  delay_reason?: string;
  delay_remarks?: string;
  created_at: string;
  updated_at: string;
  // Joined data
  waiter?: StaffMember;
  chef?: StaffMember;
}

export interface KOTOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

// Role-based permissions
export const ROLE_PERMISSIONS = {
  owner: {
    canManageStaff: true,
    canManageSettings: true,
    canManageGST: true,
    canManageWhatsApp: true,
    canManageSubscription: true,
    canViewReports: true,
    canPlaceOrders: true,
    canModifyOrders: true,
    canViewKOT: true,
    canManageKOTSettings: true,
  },
  manager: {
    canManageStaff: false,
    canManageSettings: false,
    canManageGST: false,
    canManageWhatsApp: false,
    canManageSubscription: false,
    canViewReports: true,
    canPlaceOrders: true,
    canModifyOrders: true,
    canViewKOT: true,
    canManageKOTSettings: false,
  },
  waiter: {
    canManageStaff: false,
    canManageSettings: false,
    canManageGST: false,
    canManageWhatsApp: false,
    canManageSubscription: false,
    canViewReports: false,
    canPlaceOrders: true,
    canModifyOrders: false,
    canViewKOT: false,
    canManageKOTSettings: false,
  },
  chef: {
    canManageStaff: false,
    canManageSettings: false,
    canManageGST: false,
    canManageWhatsApp: false,
    canManageSubscription: false,
    canViewReports: false,
    canPlaceOrders: false,
    canModifyOrders: false,
    canViewKOT: true,
    canManageKOTSettings: false,
  },
} as const;

export const getRolePermissions = (role: StaffRole | null) => {
  if (!role) return ROLE_PERMISSIONS.owner; // Default to owner for non-KOT users
  return ROLE_PERMISSIONS[role];
};
