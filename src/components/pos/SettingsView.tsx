import { useState } from 'react';
import { Store, Upload, Receipt } from 'lucide-react';
import { usePOSStore } from '@/stores/posStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export function SettingsView() {
  const { brand, setBrand } = usePOSStore();
  const [formData, setFormData] = useState({
    name: brand.name,
    currency: brand.currency,
    taxRate: brand.taxRate.toString(),
    logo: brand.logo || '',
    enableGST: brand.enableGST,
    cgstRate: brand.cgstRate.toString(),
    sgstRate: brand.sgstRate.toString(),
  });

  const handleSave = () => {
    setBrand({
      name: formData.name,
      currency: formData.currency,
      taxRate: parseFloat(formData.taxRate) || 0,
      logo: formData.logo || undefined,
      enableGST: formData.enableGST,
      cgstRate: parseFloat(formData.cgstRate) || 0,
      sgstRate: parseFloat(formData.sgstRate) || 0,
    });
    toast.success('Settings saved successfully');
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

  const totalGST = parseFloat(formData.cgstRate || '0') + parseFloat(formData.sgstRate || '0');

  return (
    <div className="p-6 space-y-6 max-w-2xl overflow-y-auto h-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground">Customize your restaurant branding and preferences</p>
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

        <Button variant="pos" onClick={handleSave} className="w-full">
          Save Settings
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
