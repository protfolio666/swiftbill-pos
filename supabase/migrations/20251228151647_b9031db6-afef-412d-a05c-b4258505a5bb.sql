-- Create role enum
CREATE TYPE public.staff_role AS ENUM ('owner', 'manager', 'waiter', 'chef');

-- Create chef status enum
CREATE TYPE public.chef_status AS ENUM ('online', 'offline', 'break');

-- Create order assignment mode enum
CREATE TYPE public.order_assignment_mode AS ENUM ('auto', 'claim', 'manual');

-- Create KOT order status enum
CREATE TYPE public.kot_order_status AS ENUM ('pending', 'assigned', 'preparing', 'completed', 'served', 'cancelled');

-- Staff members table (linked to owner's restaurant)
CREATE TABLE public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID NOT NULL, -- The owner who created this staff
  role staff_role NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  is_active BOOLEAN DEFAULT true,
  chef_status chef_status DEFAULT 'offline',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id)
);

-- KOT Settings table (per owner)
CREATE TABLE public.kot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE,
  kot_enabled BOOLEAN DEFAULT false,
  order_assignment_mode order_assignment_mode DEFAULT 'auto',
  default_prep_time_minutes INTEGER DEFAULT 15,
  auto_assign_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- KOT Orders table
CREATE TABLE public.kot_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL,
  order_id TEXT NOT NULL, -- Reference to local order ID
  waiter_id UUID REFERENCES public.staff_members(id),
  assigned_chef_id UUID REFERENCES public.staff_members(id),
  status kot_order_status DEFAULT 'pending',
  items JSONB NOT NULL,
  table_number INTEGER,
  customer_name TEXT,
  prep_time_minutes INTEGER,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  served_at TIMESTAMPTZ,
  delay_reason TEXT,
  delay_remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kot_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kot_orders ENABLE ROW LEVEL SECURITY;

-- Security definer function to get user's staff role
CREATE OR REPLACE FUNCTION public.get_staff_role(_user_id UUID)
RETURNS staff_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.staff_members WHERE user_id = _user_id LIMIT 1
$$;

-- Security definer function to get user's owner_id (who they work for)
CREATE OR REPLACE FUNCTION public.get_staff_owner_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM public.staff_members WHERE user_id = _user_id LIMIT 1
$$;

-- Security definer function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members 
    WHERE user_id = _user_id AND role = 'owner'
  )
$$;

-- Security definer function to check if user is manager or owner
CREATE OR REPLACE FUNCTION public.is_manager_or_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff_members 
    WHERE user_id = _user_id AND role IN ('owner', 'manager')
  )
$$;

-- RLS Policies for staff_members
-- Owners can see all their staff
CREATE POLICY "Owners can view their staff"
ON public.staff_members FOR SELECT
USING (
  owner_id = auth.uid() OR 
  owner_id = public.get_staff_owner_id(auth.uid()) OR
  user_id = auth.uid()
);

-- Only owners can create staff
CREATE POLICY "Owners can create staff"
ON public.staff_members FOR INSERT
WITH CHECK (owner_id = auth.uid() AND public.is_owner(auth.uid()));

-- Owners can update their staff, staff can update their own status
CREATE POLICY "Owners can update staff"
ON public.staff_members FOR UPDATE
USING (
  owner_id = auth.uid() OR user_id = auth.uid()
);

-- Only owners can delete staff
CREATE POLICY "Owners can delete staff"
ON public.staff_members FOR DELETE
USING (owner_id = auth.uid() AND public.is_owner(auth.uid()));

-- RLS Policies for kot_settings
CREATE POLICY "Owner can view their KOT settings"
ON public.kot_settings FOR SELECT
USING (
  owner_id = auth.uid() OR 
  owner_id = public.get_staff_owner_id(auth.uid())
);

CREATE POLICY "Owner can create KOT settings"
ON public.kot_settings FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner can update KOT settings"
ON public.kot_settings FOR UPDATE
USING (owner_id = auth.uid());

-- RLS Policies for kot_orders
-- All staff under same owner can view orders
CREATE POLICY "Staff can view orders"
ON public.kot_orders FOR SELECT
USING (
  owner_id = auth.uid() OR 
  owner_id = public.get_staff_owner_id(auth.uid())
);

-- Waiters, managers, owners can create orders
CREATE POLICY "Authorized staff can create orders"
ON public.kot_orders FOR INSERT
WITH CHECK (
  owner_id = auth.uid() OR 
  (owner_id = public.get_staff_owner_id(auth.uid()) AND 
   public.get_staff_role(auth.uid()) IN ('owner', 'manager', 'waiter'))
);

-- Chefs can update their assigned orders, managers/owners can update any
CREATE POLICY "Staff can update orders"
ON public.kot_orders FOR UPDATE
USING (
  owner_id = auth.uid() OR 
  owner_id = public.get_staff_owner_id(auth.uid())
);

-- Triggers for updated_at
CREATE TRIGGER update_staff_members_updated_at
BEFORE UPDATE ON public.staff_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kot_settings_updated_at
BEFORE UPDATE ON public.kot_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_kot_orders_updated_at
BEFORE UPDATE ON public.kot_orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for KOT orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.kot_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_members;