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

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: Subscription | null;
  hasActiveSubscription: boolean;
  isTrialActive: boolean;
  trialDaysRemaining: number;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, restaurantName: string, ownerName: string) => Promise<{ error: Error | null }>;
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
  const [isLoading, setIsLoading] = useState(true);

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

  const fetchSubscription = async (userId: string) => {
    try {
      const response = await supabase.functions.invoke('razorpay', {
        body: { action: 'check-subscription', data: { userId } }
      });
      
      if (response.data?.success) {
        setHasActiveSubscription(response.data.hasActiveSubscription);
        setSubscription(response.data.subscription || null);
        setIsTrialActive(response.data.isTrialActive || false);
        setTrialDaysRemaining(response.data.trialDaysRemaining || 0);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
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
      await fetchSubscription(user.id);
    }
  };

  useEffect(() => {
    // Prevent "flash" redirects: keep loading until getSession resolves at least once.
    const initialSessionCheckedRef = { current: false };

    // Set up auth state listener FIRST
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile and subscription fetch with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
            fetchSubscription(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setSubscription(null);
          setHasActiveSubscription(false);
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

      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchProfile(session.user.id);
        fetchSubscription(session.user.id);
      } else {
        setProfile(null);
        setSubscription(null);
        setHasActiveSubscription(false);
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
    // Reset POS store to clear user-specific data
    resetPOSStore();
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      subscription,
      hasActiveSubscription,
      isTrialActive,
      trialDaysRemaining,
      isLoading,
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
