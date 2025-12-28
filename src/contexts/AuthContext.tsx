import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { resetPOSStore } from '@/stores/posStore';

interface Profile {
  id: string;
  user_id: string;
  restaurant_name: string | null;
  owner_name: string | null;
  phone: string | null;
  address: string | null;
  gstin: string | null;
  logo_url: string | null;
}

interface Subscription {
  id: string;
  user_id: string;
  plan_name: string;
  status: string;
  valid_until: string | null;
}

export type StaffRole = 'owner' | 'manager' | 'waiter' | 'chef';

interface StaffInfo {
  id: string;
  role: StaffRole;
  owner_id: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  hasActiveSubscription: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  /** True once we have finished checking the user's subscription status for the current session */
  isSubscriptionLoaded: boolean;
  isLoading: boolean;
  /** Staff info if user is a staff member */
  staffInfo: StaffInfo | null;
  /** Whether user is a staff member (not owner) */
  isStaffMember: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (
    email: string,
    password: string,
    restaurantName: string,
    ownerName: string
  ) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [isTrialActive, setIsTrialActive] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [isSubscriptionLoaded, setIsSubscriptionLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);

  // Avoid duplicate subscription checks (startup can trigger both getSession + onAuthStateChange)
  const subscriptionCheckPromiseRef = useRef<Promise<void> | null>(null);
  const subscriptionCheckUserRef = useRef<string | null>(null);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  const fetchStaffInfo = async (userId: string): Promise<StaffInfo | null> => {
    const { data, error } = await supabase
      .from('staff_members')
      .select('id, role, owner_id, name')
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
    
    if (!error && data) {
      const info: StaffInfo = {
        id: data.id,
        role: data.role as StaffRole,
        owner_id: data.owner_id,
        name: data.name,
      };
      setStaffInfo(info);
      return info;
    }
    setStaffInfo(null);
    return null;
  };

  const fetchSubscription = (userId: string, overrideUserId?: string) => {
    const targetUserId = overrideUserId || userId;
    
    // Deduplicate in-flight checks for the same user
    if (
      subscriptionCheckPromiseRef.current &&
      subscriptionCheckUserRef.current === targetUserId
    ) {
      return subscriptionCheckPromiseRef.current;
    }

    setIsSubscriptionLoaded(false);
    subscriptionCheckUserRef.current = targetUserId;

    const p = (async () => {
      try {
        const response = await supabase.functions.invoke('razorpay', {
          body: { action: 'check-subscription', data: { userId: targetUserId } },
        });

        if (response.data?.success) {
          setHasActiveSubscription(!!response.data.hasActiveSubscription);
          setSubscription(response.data.subscription || null);
          setIsTrialActive(response.data.isTrialActive || false);
          setTrialDaysRemaining(response.data.trialDaysRemaining || 0);
        } else {
          setHasActiveSubscription(false);
          setSubscription(null);
          setIsTrialActive(false);
          setTrialDaysRemaining(0);
        }
      } catch (error) {
        console.error('Error fetching subscription:', error);
        setHasActiveSubscription(false);
        setSubscription(null);
        setIsTrialActive(false);
        setTrialDaysRemaining(0);
      } finally {
        setIsSubscriptionLoaded(true);
        // Clear the in-flight promise so future manual refreshes work
        subscriptionCheckPromiseRef.current = null;
      }
    })();

    subscriptionCheckPromiseRef.current = p;
    return p;
  };

  const createTrialSubscription = async (userId: string) => {
    try {
      const response = await supabase.functions.invoke('razorpay', {
        body: { action: 'create-trial', data: { userId } }
      });
      
      if (response.data?.success) {
        console.log('Trial subscription created:', response.data);
        await fetchSubscription(userId);
      }
    } catch (error) {
      console.error('Error creating trial subscription:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const refreshSubscription = async () => {
    if (user) {
      // If staff member, check owner's subscription
      if (staffInfo && staffInfo.role !== 'owner') {
        await fetchSubscription(user.id, staffInfo.owner_id);
      } else {
        await fetchSubscription(user.id);
      }
    }
  };

  const handleUserLogin = async (userId: string) => {
    // First check if user is a staff member
    const staff = await fetchStaffInfo(userId);
    
    if (staff && staff.role !== 'owner') {
      // Staff member - fetch OWNER's profile and check owner's subscription
      await fetchProfile(staff.owner_id);
      await fetchSubscription(userId, staff.owner_id);
    } else {
      // Owner or no staff record - check own profile and subscription
      await fetchProfile(userId);
      await fetchSubscription(userId);
    }
  };

  useEffect(() => {
    // Prevent "flash" redirects: keep loading until getSession resolves at least once.
    const initialSessionCheckedRef = { current: false };

    // Set up auth state listener FIRST
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // IMPORTANT: prevent one-frame flashes by marking subscription as "not loaded" BEFORE setting the user.
        if (session?.user) {
          setIsSubscriptionLoaded(false);
        } else {
          setIsSubscriptionLoaded(true);
        }

        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile and subscription fetch with setTimeout
        if (session?.user) {
          setTimeout(() => {
            handleUserLogin(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setSubscription(null);
          setHasActiveSubscription(false);
          setIsTrialActive(false);
          setTrialDaysRemaining(0);
          setStaffInfo(null);
        }

        // Only end loading AFTER initial session check has completed
        if (initialSessionCheckedRef.current) {
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      initialSessionCheckedRef.current = true;

      // Set subscription-loaded BEFORE setting user to avoid any auth-page flashes
      if (session?.user) {
        setIsSubscriptionLoaded(false);
      } else {
        setIsSubscriptionLoaded(true);
      }

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        handleUserLogin(session.user.id);
      } else {
        setProfile(null);
        setSubscription(null);
        setHasActiveSubscription(false);
        setIsTrialActive(false);
        setTrialDaysRemaining(0);
        setStaffInfo(null);
      }

      setIsLoading(false);
    });

    return () => authSub.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, restaurantName: string, ownerName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          restaurant_name: restaurantName,
          owner_name: ownerName,
        },
      },
    });

    // If signup successful, create trial subscription
    if (!error && data.user) {
      await createTrialSubscription(data.user.id);
    }

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSubscription(null);
    setHasActiveSubscription(false);
    setIsTrialActive(false);
    setTrialDaysRemaining(0);
    setIsSubscriptionLoaded(true);
    setStaffInfo(null);
    // Reset POS store to clear user-specific data
    resetPOSStore();
  };

  const isStaffMember = staffInfo !== null && staffInfo.role !== 'owner';

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      subscription,
      hasActiveSubscription,
      isTrialActive,
      trialDaysRemaining,
      isSubscriptionLoaded,
      isLoading,
      staffInfo,
      isStaffMember,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      refreshSubscription,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
