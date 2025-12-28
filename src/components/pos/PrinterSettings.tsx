import { useState, useEffect, forwardRef } from 'react';
import { Printer, Wifi, Bluetooth, Usb, Check, X, TestTube, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { thermalPrinter, PrinterConnectionType, PrinterPaperWidth } from '@/services/thermalPrinter';

export const PrinterSettings = forwardRef<HTMLDivElement>(function PrinterSettings(_, ref) {
  const [connectionType, setConnectionType] = useState<PrinterConnectionType>('usb');
  const [paperWidth, setPaperWidth] = useState<PrinterPaperWidth>('80mm');
  const [networkIp, setNetworkIp] = useState('');
  const [networkPort, setNetworkPort] = useState('9100');
  const [isConnecting, setIsConnecting] = useState(false);
  const [printerState, setPrinterState] = useState(thermalPrinter.getState());
  const [useThermalPrinter, setUseThermalPrinter] = useState(false);

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
        thermalPrinter.setPaperWidth(prefs.paperWidth || '80mm');
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
    thermalPrinter.setPaperWidth(paperWidth);
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
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
      
      setPrinterState(thermalPrinter.getState());
    } catch (error) {
      console.error('Connection error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to connect printer');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    await thermalPrinter.disconnect();
    setPrinterState(thermalPrinter.getState());
    toast.success('Printer disconnected');
  };

  const handleTestPrint = async () => {
    try {
      await thermalPrinter.printTestPage();
      toast.success('Test page sent to printer');
    } catch (error) {
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
    <div ref={ref} className="bg-card rounded-2xl border border-border p-6 space-y-6">
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
              <RadioGroup
                value={connectionType}
                onValueChange={(val) => setConnectionType(val as PrinterConnectionType)}
                className="grid grid-cols-3 gap-3"
              >
                <div>
                  <RadioGroupItem value="usb" id="usb" className="peer sr-only" />
                  <Label
                    htmlFor="usb"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Usb className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">USB</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="bluetooth" id="bluetooth" className="peer sr-only" />
                  <Label
                    htmlFor="bluetooth"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Bluetooth className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">Bluetooth</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="network" id="network" className="peer sr-only" />
                  <Label
                    htmlFor="network"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <Wifi className="mb-2 h-6 w-6" />
                    <span className="text-sm font-medium">Network</span>
                  </Label>
                </div>
              </RadioGroup>
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
              <RadioGroup
                value={paperWidth}
                onValueChange={(val) => {
                  setPaperWidth(val as PrinterPaperWidth);
                  thermalPrinter.setPaperWidth(val as PrinterPaperWidth);
                }}
                className="grid grid-cols-2 gap-3"
              >
                <div>
                  <RadioGroupItem value="58mm" id="58mm" className="peer sr-only" />
                  <Label
                    htmlFor="58mm"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <span className="text-lg font-bold">58mm</span>
                    <span className="text-xs text-muted-foreground">2 inch / 32 chars</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="80mm" id="80mm" className="peer sr-only" />
                  <Label
                    htmlFor="80mm"
                    className="flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                  >
                    <span className="text-lg font-bold">80mm</span>
                    <span className="text-xs text-muted-foreground">3 inch / 48 chars</span>
                  </Label>
                </div>
              </RadioGroup>
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
});
