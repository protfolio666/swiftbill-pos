import { useState, useEffect } from 'react';
import { Printer, Wifi, Bluetooth, Usb, Check, X, TestTube, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { thermalPrinter, PrinterConnectionType, PrinterPaperWidth } from '@/services/thermalPrinter';

export function PrinterSettings() {
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>('usb');
  const [paperWidth, setPaperWidth] = useState<PrinterPaperWidth>('80mm');
  const [networkIp, setNetworkIp] = useState('');
  const [networkPort, setNetworkPort] = useState('9100');
  const [isConnecting, setIsConnecting] = useState(false);
  const [useThermalPrinter, setUseThermalPrinter] = useState(false);
  
  // Safely get printer state
  const getPrinterState = () => {
    try {
      return thermalPrinter.getState();
    } catch (e) {
      console.error('Failed to get printer state:', e);
      return {
        isConnected: false,
        connectionType: null,
        deviceName: null,
        paperWidth: '80mm' as PrinterPaperWidth,
      };
    }
  };
  
  const [printerState, setPrinterState] = useState(getPrinterState);

  // Load saved preferences
  useEffect(() => {
    const saved = localStorage.getItem('thermalPrinterPrefs');
    if (saved) {
      try {
        const prefs = JSON.parse(saved);
        setConnectionType(prefs.connectionType || 'usb');
        setPaperWidth(prefs.paperWidth || '80mm');
        setNetworkIp(prefs.networkIp || '');
        setNetworkPort(prefs.networkPort || '9100');
        setUseThermalPrinter(prefs.useThermalPrinter || false);
        try {
          thermalPrinter.setPaperWidth(prefs.paperWidth || '80mm');
        } catch (e) {
          console.error('Failed to set paper width:', e);
        }
      } catch (e) {
        console.error('Failed to load printer preferences:', e);
      }
    }
  }, []);

  // Save preferences
  const savePreferences = () => {
    localStorage.setItem('thermalPrinterPrefs', JSON.stringify({
      connectionType,
      paperWidth,
      networkIp,
      networkPort,
      useThermalPrinter,
    }));
    try {
      thermalPrinter.setPaperWidth(paperWidth);
    } catch (e) {
      console.error('Failed to set paper width:', e);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const isEmbeddedPreview = (() => {
        try {
          return window.self !== window.top;
        } catch {
          return true;
        }
      })();

      // In embedded previews, browser permission policies often block Serial/Bluetooth.
      if (isEmbeddedPreview && (connectionType === 'usb' || connectionType === 'bluetooth')) {
        toast.error('Printer connection is blocked in preview. Open the app in a new tab or after publish to connect.');
        return;
      }

      let success = false;

      switch (connectionType) {
        case 'usb':
          if (!thermalPrinter.isSerialSupported()) {
            toast.error('USB printing requires Chrome or Edge browser');
            break;
          }
          success = await thermalPrinter.connectUSB();
          break;

        case 'bluetooth':
          if (!thermalPrinter.isBluetoothSupported()) {
            toast.error('Bluetooth printing is not supported in this browser');
            break;
          }
          success = await thermalPrinter.connectBluetooth();
          break;

        case 'network':
          if (!networkIp) {
            toast.error('Please enter the printer IP address');
            break;
          }
          success = await thermalPrinter.connectNetwork(networkIp, parseInt(networkPort) || 9100);
          break;
      }

      if (success) {
        toast.success('Printer connected successfully!');
        savePreferences();
      }

      setPrinterState(getPrinterState());
    } catch (error: any) {
      console.error('Connection error:', error);
      const msg = typeof error?.message === 'string' ? error.message : 'Failed to connect printer';
      toast.error(msg);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await thermalPrinter.disconnect();
      setPrinterState(getPrinterState());
      toast.success('Printer disconnected');
    } catch (error) {
      console.error('Disconnect error:', error);
      toast.error('Failed to disconnect printer');
    }
  };

  const handleTestPrint = async () => {
    try {
      await thermalPrinter.printTestPage();
      toast.success('Test page sent to printer');
    } catch (error) {
      console.error('Test print error:', error);
      toast.error('Failed to print test page');
    }
  };

  const handleToggleThermalPrinter = (enabled: boolean) => {
    setUseThermalPrinter(enabled);
    localStorage.setItem('thermalPrinterPrefs', JSON.stringify({
      connectionType,
      paperWidth,
      networkIp,
      networkPort,
      useThermalPrinter: enabled,
    }));
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <Printer className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h2 className="font-semibold text-lg text-foreground">Thermal Printer</h2>
          <p className="text-sm text-muted-foreground">Configure direct thermal printing</p>
        </div>
        <Badge variant={printerState.isConnected ? 'default' : 'secondary'} className={printerState.isConnected ? 'bg-green-500' : ''}>
          {printerState.isConnected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-xl">
        <div>
          <p className="font-medium text-foreground">Use Thermal Printer</p>
          <p className="text-sm text-muted-foreground">Print receipts directly to thermal printer</p>
        </div>
        <Switch
          checked={useThermalPrinter}
          onCheckedChange={handleToggleThermalPrinter}
        />
      </div>

      {useThermalPrinter && (
        <>
          {/* Connection Type */}
          <div className="space-y-3">
            <Label>Connection Type</Label>
            <Select value={connectionType} onValueChange={(val) => setConnectionType(val as PrinterConnectionType)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select connection type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="usb">
                  <span className="inline-flex items-center gap-2">
                    <Usb className="h-4 w-4" /> USB
                  </span>
                </SelectItem>
                <SelectItem value="bluetooth" disabled={!thermalPrinter.isBluetoothSupported()}>
                  <span className="inline-flex items-center gap-2">
                    <Bluetooth className="h-4 w-4" /> Bluetooth
                  </span>
                </SelectItem>
                <SelectItem value="network">
                  <span className="inline-flex items-center gap-2">
                    <Wifi className="h-4 w-4" /> Network
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Network Settings */}
          {connectionType === 'network' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ip">Printer IP Address</Label>
                <Input
                  id="ip"
                  placeholder="192.168.1.100"
                  value={networkIp}
                  onChange={(e) => setNetworkIp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="port">Port</Label>
                <Input
                  id="port"
                  placeholder="9100"
                  value={networkPort}
                  onChange={(e) => setNetworkPort(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Paper Width */}
          <div className="space-y-3">
            <Label>Paper Width</Label>
            <Select
              value={paperWidth}
              onValueChange={(val) => {
                setPaperWidth(val as PrinterPaperWidth);
                try {
                  thermalPrinter.setPaperWidth(val as PrinterPaperWidth);
                } catch (e) {
                  console.error('Failed to set paper width:', e);
                }
              }}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select paper width" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="58mm">58mm (2 inch / 32 chars)</SelectItem>
                <SelectItem value="80mm">80mm (3 inch / 48 chars)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Browser Support Info */}
          <div className="p-3 bg-amber-500/10 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Note:</strong> USB printing requires Chrome or Edge. Bluetooth printing requires a compatible browser with Web Bluetooth support.
            </p>
          </div>

          {/* Connection Buttons */}
          <div className="flex gap-3">
            {printerState.isConnected ? (
              <>
                <Button variant="outline" onClick={handleDisconnect} className="flex-1">
                  <X className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
                <Button variant="outline" onClick={handleTestPrint}>
                  <TestTube className="w-4 h-4 mr-2" />
                  Test Print
                </Button>
              </>
            ) : (
              <Button onClick={handleConnect} disabled={isConnecting} className="flex-1 pos-gradient">
                {isConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Connect Printer
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Connected Device Info */}
          {printerState.isConnected && printerState.deviceName && (
            <div className="p-3 bg-green-500/10 rounded-lg">
              <p className="text-sm text-green-700 dark:text-green-400">
                Connected to: <strong>{printerState.deviceName}</strong>
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
