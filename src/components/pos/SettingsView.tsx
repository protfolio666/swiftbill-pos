import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Upload, Receipt, QrCode, Crown, Clock, CreditCard, Check, Loader2 } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNeon } from '@/contexts/NeonContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayResponse) => void;
  prefill: {
    email: string;
  };
  theme: {
    color: string;
  };
}

interface RazorpayInstance {
  open: () => void;
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (document.getElementById('razorpay-script')) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-script';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const SUBSCRIPTION_PLANS = [
  {
    id: 'monthly',
    name: 'Monthly',
    price: 499,
    duration: '1 Month',
    features: ['Unlimited Orders', 'Menu Management', 'Sales Analytics', 'Cloud Sync'],
  },
  {
    id: 'yearly',
    name: 'Yearly',
    price: 4999,
    duration: '12 Months',
    features: ['Everything in Monthly', '2 Months Free', 'Priority Support'],
    popular: true,
  },
];

export function SettingsView() {
  const { brand, setBrand } = usePOSStore();
  const { saveBrandSettings } = useNeon();
  const { user, subscription, isTrialActive, trialDaysRemaining, hasActiveSubscription, refreshSubscription } = useAuth();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [isPaymentLoading, setIsPaymentLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: brand.name,
    currency: brand.currency,
    taxRate: (brand.taxRate ?? 5).toString(),
    logo: brand.logo || '',
    enableGST: brand.enableGST ?? true,
    cgstRate: (brand.cgstRate ?? 2.5).toString(),
    sgstRate: (brand.sgstRate ?? 2.5).toString(),
    upiId: brand.upiId || '',
    gstin: brand.gstin || '',
    showGstOnReceipt: brand.showGstOnReceipt ?? false,
  });

  // Do NOT call refreshSubscription here - it causes the app to flash
  // back to loading state. Subscription is already fetched on login.

  const handleSave = async () => {
    setIsSaving(true);
    
    setBrand({
      name: formData.name,
      currency: formData.currency,
      taxRate: parseFloat(formData.taxRate) || 0,
      logo: formData.logo || undefined,
      enableGST: formData.enableGST,
      cgstRate: parseFloat(formData.cgstRate) || 0,
      sgstRate: parseFloat(formData.sgstRate) || 0,
      upiId: formData.upiId || undefined,
      gstin: formData.gstin || undefined,
      showGstOnReceipt: formData.showGstOnReceipt,
    });

    await saveBrandSettings({
      name: formData.name,
      currency: formData.currency,
      logo: formData.logo || undefined,
      upiId: formData.upiId || undefined,
      taxRate: parseFloat(formData.taxRate) || 0,
      enableGST: formData.enableGST,
      cgstRate: parseFloat(formData.cgstRate) || 0,
      sgstRate: parseFloat(formData.sgstRate) || 0,
      gstin: formData.gstin || undefined,
      showGstOnReceipt: formData.showGstOnReceipt,
    });

    // Sync user profile to Neon DB
    if (user) {
      try {
        await supabase.functions.invoke('neon-db', {
          body: {
            action: 'syncUser',
            data: {
              id: user.id,
              email: user.email,
              restaurant_name: formData.name,
              owner_name: user.user_metadata?.owner_name || null,
              plan_name: subscription?.plan_name || 'trial',
              subscription_status: subscription?.status || 'pending',
              valid_until: subscription?.valid_until || null,
              logo_url: formData.logo || null,
            }
          }
        });
        console.log('User profile synced to Neon DB');
      } catch (err) {
        console.error('Failed to sync user to Neon:', err);
      }
    }

    toast.success('Settings saved successfully');
    setIsSaving(false);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setFormData({ ...formData, logo: result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePayment = async (plan: typeof SUBSCRIPTION_PLANS[0]) => {
    if (!user) {
      toast.error('Please login first');
      return;
    }

    setIsPaymentLoading(true);
    
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway. Please try again.');
        setIsPaymentLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('razorpay', {
        body: {
          action: 'create-order',
          data: {
            amount: plan.price,
            currency: 'INR',
            userId: user.id,
            planName: plan.id,
          }
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to create order');
      }

      const options: RazorpayOptions = {
        key: data.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
        name: 'Restaurant POS',
        description: `${plan.name} Subscription`,
        order_id: data.order.id,
        handler: async (response: RazorpayResponse) => {
          try {
            const { data: verifyData, error: verifyError } = await supabase.functions.invoke('razorpay', {
              body: {
                action: 'verify-payment',
                data: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                  userId: user.id,
                  planName: plan.id,
                  amount: plan.price,
                }
              }
            });

            if (verifyError || !verifyData?.success) {
              throw new Error('Payment verification failed');
            }

            toast.success('Payment successful! Your subscription is now active.');
            await refreshSubscription();
          } catch (err) {
            console.error('Payment verification error:', err);
            toast.error('Payment verification failed. Please contact support.');
          }
        },
        prefill: {
          email: user.email || '',
        },
        theme: {
          color: '#f97316',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      console.error('Payment error:', err);
      toast.error('Failed to initiate payment. Please try again.');
    } finally {
      setIsPaymentLoading(false);
    }
  };

  const totalGST = parseFloat(formData.cgstRate || '0') + parseFloat(formData.sgstRate || '0');

  const getPlanBadge = () => {
    if (!subscription) return null;
    if (subscription.plan_name === 'trial') {
      return <Badge className="bg-amber-500">Trial</Badge>;
    }
    if (subscription.plan_name === 'lifetime') {
      return <Badge className="bg-purple-500">Lifetime</Badge>;
    }
    if (subscription.plan_name === 'monthly') {
      return <Badge className="bg-blue-500">Monthly</Badge>;
    }
    if (subscription.plan_name === 'yearly') {
      return <Badge className="bg-green-500">Yearly</Badge>;
    }
    return <Badge variant="outline">{subscription.plan_name}</Badge>;
  };

  return (
    <div className="p-6 space-y-6 max-w-2xl overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Customize your restaurant branding and preferences</p>
      </div>

      {/* Subscription Card */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-500 flex items-center justify-center">
            <Crown className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-lg text-foreground">Subscription</h2>
            <p className="text-sm text-muted-foreground">Manage your plan</p>
          </div>
          {getPlanBadge()}
        </div>

        {/* Current Plan Info */}
        <div className="p-4 bg-secondary/50 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Plan</span>
            <span className="font-medium capitalize">{subscription?.plan_name || 'None'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Status</span>
            <span className={`font-medium ${hasActiveSubscription ? 'text-green-500' : 'text-red-500'}`}>
              {hasActiveSubscription ? 'Active' : 'Expired'}
            </span>
          </div>
          {subscription?.valid_until && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valid Until</span>
              <span className="font-medium">
                {subscription.plan_name === 'lifetime' ? 'Forever' : format(new Date(subscription.valid_until), 'MMM dd, yyyy')}
              </span>
            </div>
          )}
          {isTrialActive && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg mt-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-600 dark:text-amber-400">
                <strong>{trialDaysRemaining} days</strong> remaining in your free trial
              </span>
            </div>
          )}
        </div>

        {/* Upgrade Options */}
        {(isTrialActive || !hasActiveSubscription || subscription?.plan_name === 'trial') && subscription?.plan_name !== 'lifetime' && (
          <div className="space-y-4">
            <h3 className="font-medium text-foreground">Upgrade Your Plan</h3>
            <div className="grid gap-4">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div 
                  key={plan.id}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    plan.popular 
                      ? 'border-orange-500 bg-orange-500/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{plan.name}</span>
                        {plan.popular && (
                          <Badge className="bg-orange-500 text-xs">Best Value</Badge>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">{plan.duration}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold">₹{plan.price}</span>
                    </div>
                  </div>
                  <ul className="space-y-1 mb-4">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button 
                    onClick={() => handlePayment(plan)}
                    disabled={isPaymentLoading}
                    className={`w-full ${plan.popular ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' : ''}`}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {isPaymentLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="mr-2 h-4 w-4" />
                        {isTrialActive ? 'Upgrade Now' : 'Subscribe'}
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Already subscribed message */}
        {hasActiveSubscription && subscription?.plan_name !== 'trial' && (
          <div className="p-4 bg-green-500/10 rounded-xl flex items-center gap-3">
            <Check className="h-5 w-5 text-green-500" />
            <span className="text-green-600 dark:text-green-400">
              {subscription?.plan_name === 'lifetime' 
                ? "You have a Lifetime subscription. Thank you!"
                : <>You're on the <strong className="capitalize">{subscription?.plan_name}</strong> plan. Thank you for your support!</>
              }
            </span>
          </div>
        )}
      </div>

      {/* Brand Settings Card */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl pos-gradient flex items-center justify-center">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <h2 className="font-semibold text-lg text-foreground">Brand Settings</h2>
        </div>

        {/* Logo Upload */}
        <div className="space-y-3">
          <Label>Restaurant Logo</Label>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-border bg-secondary/50 flex items-center justify-center overflow-hidden">
              {formData.logo ? (
                <img src={formData.logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-2">
              <input
                type="file"
                id="logo-upload"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button variant="outline" asChild>
                <label htmlFor="logo-upload" className="cursor-pointer">
                  Upload Logo
                </label>
              </Button>
              {formData.logo && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFormData({ ...formData, logo: '' })}
                  className="text-destructive"
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Restaurant Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Restaurant Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="My Restaurant"
          />
        </div>

        {/* Currency */}
        <div className="space-y-2">
          <Label htmlFor="currency">Currency Symbol</Label>
          <Input
            id="currency"
            value={formData.currency}
            onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
            placeholder="₹"
            maxLength={3}
            className="w-24"
          />
        </div>
      </div>

      {/* UPI Payment Settings Card */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-foreground">UPI Payment</h2>
            <p className="text-sm text-muted-foreground">Add UPI QR code to bills</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="upiId">UPI ID</Label>
          <Input
            id="upiId"
            value={formData.upiId}
            onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
            placeholder="yourname@upi or 9876543210@paytm"
          />
          <p className="text-xs text-muted-foreground">
            Enter your UPI ID to generate payment QR codes on bills
          </p>
        </div>

        {formData.upiId && (
          <div className="p-3 bg-green-500/10 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-400">
              ✓ UPI QR code will be shown on printed bills
            </p>
          </div>
        )}
      </div>

      {/* Tax Settings Card */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center">
              <span className="text-lg font-bold text-green-600">GST</span>
            </div>
            <div>
              <h2 className="font-semibold text-lg text-foreground">Tax Settings</h2>
              <p className="text-sm text-muted-foreground">Configure GST or simple tax</p>
            </div>
          </div>
        </div>

        {/* GST Toggle */}
        <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
          <div>
            <p className="font-medium text-foreground">Enable GST (CGST + SGST)</p>
            <p className="text-sm text-muted-foreground">Split tax into CGST and SGST components</p>
          </div>
          <Switch
            checked={formData.enableGST}
            onCheckedChange={(checked) => setFormData({ ...formData, enableGST: checked })}
          />
        </div>

        {formData.enableGST ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cgstRate">CGST Rate (%)</Label>
                <Input
                  id="cgstRate"
                  type="number"
                  value={formData.cgstRate}
                  onChange={(e) => setFormData({ ...formData, cgstRate: e.target.value })}
                  placeholder="2.5"
                  min="0"
                  max="50"
                  step="0.5"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sgstRate">SGST Rate (%)</Label>
                <Input
                  id="sgstRate"
                  type="number"
                  value={formData.sgstRate}
                  onChange={(e) => setFormData({ ...formData, sgstRate: e.target.value })}
                  placeholder="2.5"
                  min="0"
                  max="50"
                  step="0.5"
                />
              </div>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400">
                Total GST: <span className="font-bold">{totalGST}%</span> (CGST {formData.cgstRate}% + SGST {formData.sgstRate}%)
              </p>
            </div>

            {/* GSTIN Input */}
            <div className="space-y-2">
              <Label htmlFor="gstin">GSTIN Number</Label>
              <Input
                id="gstin"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
                placeholder="22AAAAA0000A1Z5"
                maxLength={15}
              />
            </div>

            {/* Show GST on Receipt Toggle */}
            <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
              <div>
                <p className="font-medium text-foreground">Show GSTIN on Receipt</p>
                <p className="text-sm text-muted-foreground">Display GSTIN number on printed bills</p>
              </div>
              <Switch
                checked={formData.showGstOnReceipt}
                onCheckedChange={(checked) => setFormData({ ...formData, showGstOnReceipt: checked })}
                disabled={!formData.gstin}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="taxRate">Tax Rate (%)</Label>
            <Input
              id="taxRate"
              type="number"
              value={formData.taxRate}
              onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
              placeholder="5"
              min="0"
              max="100"
              className="w-32"
            />
          </div>
        )}

        <Button variant="pos" onClick={handleSave} className="w-full" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Preview Card */}
      <div className="bg-card rounded-2xl border border-border p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center">
            <Receipt className="w-5 h-5 text-muted-foreground" />
          </div>
          <h2 className="font-semibold text-lg text-foreground">Bill Preview</h2>
        </div>

        <div className="bg-background rounded-xl p-4 border border-border">
          <div className="text-center space-y-2 pb-4 border-b border-dashed border-border">
            {formData.logo && (
              <img src={formData.logo} alt="Logo" className="w-12 h-12 mx-auto object-contain" />
            )}
            <h3 className="font-bold text-lg text-foreground">{formData.name || 'Restaurant Name'}</h3>
            <p className="text-xs text-muted-foreground">Thank you for dining with us!</p>
          </div>
          <div className="py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sample Item x2</span>
              <span className="text-foreground">{formData.currency}100.00</span>
            </div>
            <div className="flex justify-between text-green-600">
              <span>Discount (10%)</span>
              <span>-{formData.currency}10.00</span>
            </div>
            {formData.enableGST ? (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CGST ({formData.cgstRate}%)</span>
                  <span className="text-foreground">{formData.currency}{(90 * parseFloat(formData.cgstRate || '0') / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">SGST ({formData.sgstRate}%)</span>
                  <span className="text-foreground">{formData.currency}{(90 * parseFloat(formData.sgstRate || '0') / 100).toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax ({formData.taxRate}%)</span>
                <span className="text-foreground">{formData.currency}{(90 * parseFloat(formData.taxRate || '0') / 100).toFixed(2)}</span>
              </div>
            )}
          </div>
          <div className="pt-4 border-t border-dashed border-border">
            <div className="flex justify-between font-bold">
              <span className="text-foreground">Total</span>
              <span className="text-primary">
                {formData.currency}
                {formData.enableGST 
                  ? (90 + 90 * totalGST / 100).toFixed(2)
                  : (90 + 90 * parseFloat(formData.taxRate || '0') / 100).toFixed(2)
                }
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
