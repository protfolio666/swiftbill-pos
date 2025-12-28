// Type declarations for Web APIs
declare global {
  interface Navigator {
    serial?: {
      requestPort(): Promise<SerialPortType>;
    };
    bluetooth?: {
      requestDevice(options: BluetoothRequestOptions): Promise<BluetoothDeviceType>;
    };
  }
}

interface SerialPortType {
  open(options: { baudRate: number; dataBits?: number; stopBits?: number; parity?: string }): Promise<void>;
  close(): Promise<void>;
  writable: WritableStream | null;
}

interface BluetoothRequestOptions {
  filters?: Array<{ services?: string[]; namePrefix?: string }>;
  optionalServices?: string[];
  acceptAllDevices?: boolean;
}

interface BluetoothDeviceType {
  name?: string;
  gatt?: {
    connected: boolean;
    connect(): Promise<BluetoothGATTServer>;
    disconnect(): void;
  };
}

interface BluetoothGATTServer {
  getPrimaryService(service: string): Promise<BluetoothGATTService>;
}

interface BluetoothGATTService {
  getCharacteristics(): Promise<BluetoothCharacteristicType[]>;
}

interface BluetoothCharacteristicType {
  properties: {
    write: boolean;
    writeWithoutResponse: boolean;
  };
  writeValue(value: BufferSource): Promise<void>;
  writeValueWithoutResponse(value: BufferSource): Promise<void>;
}

// ESC/POS Commands for thermal printers
const ESC = '\x1B';
const GS = '\x1D';
const LF = '\x0A';

// Command constants
const COMMANDS = {
  INIT: ESC + '@',                    // Initialize printer
  ALIGN_CENTER: ESC + 'a' + '\x01',   // Center alignment
  ALIGN_LEFT: ESC + 'a' + '\x00',     // Left alignment
  ALIGN_RIGHT: ESC + 'a' + '\x02',    // Right alignment
  BOLD_ON: ESC + 'E' + '\x01',        // Bold on
  BOLD_OFF: ESC + 'E' + '\x00',       // Bold off
  DOUBLE_WIDTH: GS + '!' + '\x10',    // Double width
  DOUBLE_HEIGHT: GS + '!' + '\x01',   // Double height
  DOUBLE_SIZE: GS + '!' + '\x11',     // Double width and height
  NORMAL_SIZE: GS + '!' + '\x00',     // Normal size
  UNDERLINE_ON: ESC + '-' + '\x01',   // Underline on
  UNDERLINE_OFF: ESC + '-' + '\x00',  // Underline off
  CUT: GS + 'V' + '\x00',             // Full cut
  PARTIAL_CUT: GS + 'V' + '\x01',     // Partial cut
  FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n), // Feed n lines
};

export type PrinterPaperWidth = '58mm' | '80mm';
export type PrinterConnectionType = 'usb' | 'bluetooth' | 'network';

export interface PrinterConfig {
  connectionType: PrinterConnectionType;
  paperWidth: PrinterPaperWidth;
  networkIp?: string;
  networkPort?: number;
}

export interface ThermalPrinterState {
  isConnected: boolean;
  connectionType: PrinterConnectionType | null;
  deviceName: string | null;
  paperWidth: PrinterPaperWidth;
}

// Character widths per paper size
const CHAR_WIDTH = {
  '58mm': 32,
  '80mm': 48,
};

class ThermalPrinterService {
  private serialPort: SerialPortType | null = null;
  private bluetoothDevice: BluetoothDeviceType | null = null;
  private bluetoothCharacteristic: BluetoothCharacteristicType | null = null;
  private networkSocket: WebSocket | null = null;
  private config: PrinterConfig = {
    connectionType: 'usb',
    paperWidth: '80mm',
  };

  getCharWidth(): number {
    return CHAR_WIDTH[this.config.paperWidth];
  }

  // Check if Web Serial API is supported
  isSerialSupported(): boolean {
    return 'serial' in navigator;
  }

  // Check if Web Bluetooth API is supported
  isBluetoothSupported(): boolean {
    return 'bluetooth' in navigator;
  }

  // Connect via USB (Web Serial API)
  async connectUSB(): Promise<boolean> {
    if (!this.isSerialSupported()) {
      throw new Error('Web Serial API is not supported in this browser. Please use Chrome or Edge.');
    }

    try {
      // Request port from user
      this.serialPort = await (navigator as any).serial.requestPort();
      
      // Open the port with common thermal printer settings
      await this.serialPort.open({ 
        baudRate: 9600,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
      });

      this.config.connectionType = 'usb';
      console.log('USB Printer connected');
      return true;
    } catch (error) {
      console.error('USB connection failed:', error);
      throw error;
    }
  }

  // Connect via Bluetooth
  async connectBluetooth(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      throw new Error('Web Bluetooth API is not supported in this browser.');
    }

    try {
      // Request Bluetooth device with printer service
      this.bluetoothDevice = await navigator.bluetooth.requestDevice({
        filters: [
          { services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, // Common printer service
          { namePrefix: 'Printer' },
          { namePrefix: 'POS' },
          { namePrefix: 'BT' },
        ],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
        acceptAllDevices: false,
      }).catch(() => {
        // If no filters match, try with acceptAllDevices
        return navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
        });
      });

      if (!this.bluetoothDevice.gatt) {
        throw new Error('Bluetooth GATT not available');
      }

      const server = await this.bluetoothDevice.gatt.connect();
      
      // Try common printer services
      const serviceUUIDs = [
        '000018f0-0000-1000-8000-00805f9b34fb',
        '49535343-fe7d-4ae5-8fa9-9fafd205e455',
      ];

      for (const serviceUUID of serviceUUIDs) {
        try {
          const service = await server.getPrimaryService(serviceUUID);
          const characteristics = await service.getCharacteristics();
          
          // Find writable characteristic
          for (const char of characteristics) {
            if (char.properties.write || char.properties.writeWithoutResponse) {
              this.bluetoothCharacteristic = char;
              this.config.connectionType = 'bluetooth';
              console.log('Bluetooth Printer connected:', this.bluetoothDevice.name);
              return true;
            }
          }
        } catch (e) {
          continue;
        }
      }

      throw new Error('No writable characteristic found');
    } catch (error) {
      console.error('Bluetooth connection failed:', error);
      throw error;
    }
  }

  // Connect via Network (WebSocket or HTTP)
  async connectNetwork(ip: string, port: number = 9100): Promise<boolean> {
    try {
      this.config.connectionType = 'network';
      this.config.networkIp = ip;
      this.config.networkPort = port;
      
      // Network printers typically use raw TCP on port 9100
      // Since browsers can't do raw TCP, we'll use a print-via-API approach
      // Store the config for later use
      console.log('Network printer configured:', ip, port);
      return true;
    } catch (error) {
      console.error('Network connection failed:', error);
      throw error;
    }
  }

  // Disconnect
  async disconnect(): Promise<void> {
    if (this.serialPort) {
      await this.serialPort.close();
      this.serialPort = null;
    }
    if (this.bluetoothDevice?.gatt?.connected) {
      this.bluetoothDevice.gatt.disconnect();
    }
    this.bluetoothDevice = null;
    this.bluetoothCharacteristic = null;
  }

  // Get connection state
  getState(): ThermalPrinterState {
    return {
      isConnected: this.isConnected(),
      connectionType: this.config.connectionType,
      deviceName: this.bluetoothDevice?.name || null,
      paperWidth: this.config.paperWidth,
    };
  }

  // Check if connected
  isConnected(): boolean {
    switch (this.config.connectionType) {
      case 'usb':
        return this.serialPort !== null;
      case 'bluetooth':
        return this.bluetoothDevice?.gatt?.connected || false;
      case 'network':
        return this.config.networkIp !== undefined;
      default:
        return false;
    }
  }

  // Set paper width
  setPaperWidth(width: PrinterPaperWidth): void {
    this.config.paperWidth = width;
  }

  // Send raw data to printer
  private async sendData(data: string): Promise<void> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(data);

    switch (this.config.connectionType) {
      case 'usb':
        if (this.serialPort && this.serialPort.writable) {
          const writer = this.serialPort.writable.getWriter();
          await writer.write(bytes);
          writer.releaseLock();
        }
        break;

      case 'bluetooth':
        if (this.bluetoothCharacteristic) {
          // Send in chunks of 20 bytes (BLE limit)
          const chunkSize = 20;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, i + chunkSize);
            if (this.bluetoothCharacteristic.properties.writeWithoutResponse) {
              await this.bluetoothCharacteristic.writeValueWithoutResponse(chunk);
            } else {
              await this.bluetoothCharacteristic.writeValue(chunk);
            }
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between chunks
          }
        }
        break;

      case 'network':
        // For network printers, we'll use an edge function or fallback to browser print
        console.log('Network printing - data prepared');
        break;
    }
  }

  // Format text to fit paper width
  private formatLine(left: string, right: string = ''): string {
    const width = this.getCharWidth();
    if (!right) {
      return left.substring(0, width) + LF;
    }
    const spaces = width - left.length - right.length;
    if (spaces < 1) {
      return left.substring(0, width - right.length - 1) + ' ' + right + LF;
    }
    return left + ' '.repeat(spaces) + right + LF;
  }

  private centerText(text: string): string {
    const width = this.getCharWidth();
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text.substring(0, width) + LF;
  }

  private divider(char: string = '-'): string {
    return char.repeat(this.getCharWidth()) + LF;
  }

  // Generate receipt data for thermal printer
  generateReceiptData(order: {
    id: string;
    items: Array<{ name: string; quantity: number; price: number }>;
    subtotal: number;
    discount?: number;
    cgst?: number;
    sgst?: number;
    total: number;
    date: Date;
    orderType: 'dine-in' | 'takeaway' | 'delivery';
    tableNumber?: number;
    customerName?: string;
    customerPhone?: string;
  }, brand: {
    name: string;
    currency: string;
    gstin?: string;
    showGstOnReceipt?: boolean;
    upiId?: string;
    cgstRate?: number;
    sgstRate?: number;
    taxRate?: number;
  }): string {
    let data = '';
    const orderDate = new Date(order.date);

    // Initialize printer
    data += COMMANDS.INIT;

    // Header - Brand name
    data += COMMANDS.ALIGN_CENTER;
    data += COMMANDS.BOLD_ON;
    data += COMMANDS.DOUBLE_SIZE;
    data += brand.name.toUpperCase() + LF;
    data += COMMANDS.NORMAL_SIZE;
    data += COMMANDS.BOLD_OFF;

    // GSTIN if enabled
    if (brand.showGstOnReceipt && brand.gstin) {
      data += 'GSTIN: ' + brand.gstin + LF;
    }
    data += LF;

    // Order info
    data += COMMANDS.ALIGN_LEFT;
    data += this.divider('=');
    data += this.formatLine('Slip:', order.id);
    data += this.formatLine('Date:', orderDate.toLocaleDateString());
    data += this.formatLine('Time:', orderDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    
    // Order type
    data += COMMANDS.ALIGN_CENTER;
    data += COMMANDS.BOLD_ON;
    const orderTypeLabel = order.orderType === 'dine-in' ? 'DINE-IN' : order.orderType === 'delivery' ? 'DELIVERY' : 'TAKEAWAY';
    data += '[ ' + orderTypeLabel + ' ]' + LF;
    data += COMMANDS.BOLD_OFF;

    // Table number
    if (order.orderType === 'dine-in' && order.tableNumber) {
      data += COMMANDS.DOUBLE_SIZE;
      data += 'TABLE: ' + order.tableNumber + LF;
      data += COMMANDS.NORMAL_SIZE;
    }

    // Customer details
    if (order.customerName || order.customerPhone) {
      data += COMMANDS.ALIGN_LEFT;
      data += this.divider('-');
      if (order.customerName) {
        data += this.formatLine('Customer:', order.customerName);
      }
      if (order.customerPhone) {
        data += this.formatLine('Phone:', order.customerPhone);
      }
    }

    // Items header
    data += COMMANDS.ALIGN_LEFT;
    data += this.divider('=');
    data += COMMANDS.BOLD_ON;
    data += this.formatLine('ITEM', 'AMOUNT');
    data += COMMANDS.BOLD_OFF;
    data += this.divider('-');

    // Items
    for (const item of order.items) {
      const itemTotal = (item.price * item.quantity).toFixed(2);
      data += this.formatLine(
        `${item.quantity}x ${item.name.substring(0, this.getCharWidth() - 15)}`,
        brand.currency + itemTotal
      );
    }

    // Totals
    data += this.divider('=');
    data += this.formatLine('Subtotal', brand.currency + order.subtotal.toFixed(2));

    if (order.discount && order.discount > 0) {
      data += this.formatLine('Discount', '-' + brand.currency + order.discount.toFixed(2));
    }

    // Tax details
    data += this.divider('-');
    const hasGST = (order.cgst ?? 0) > 0 || (order.sgst ?? 0) > 0;
    if (hasGST) {
      data += this.formatLine(`CGST @${brand.cgstRate ?? 2.5}%`, brand.currency + (order.cgst ?? 0).toFixed(2));
      data += this.formatLine(`SGST @${brand.sgstRate ?? 2.5}%`, brand.currency + (order.sgst ?? 0).toFixed(2));
    } else {
      const taxAmount = order.total - order.subtotal + (order.discount ?? 0);
      data += this.formatLine(`Tax @${brand.taxRate ?? 5}%`, brand.currency + taxAmount.toFixed(2));
    }

    // Grand total
    data += this.divider('=');
    data += COMMANDS.BOLD_ON;
    data += COMMANDS.DOUBLE_SIZE;
    data += COMMANDS.ALIGN_CENTER;
    data += 'TOTAL: ' + brand.currency + order.total.toFixed(2) + LF;
    data += COMMANDS.NORMAL_SIZE;
    data += COMMANDS.BOLD_OFF;
    data += this.divider('=');

    // UPI
    if (brand.upiId) {
      data += LF;
      data += 'Scan to Pay: ' + brand.upiId + LF;
    }

    // Footer
    data += LF;
    data += COMMANDS.ALIGN_CENTER;
    data += 'Thank you for your visit!' + LF;
    data += '* * * * *' + LF;
    data += 'Welcome again' + LF;

    // Feed and cut
    data += COMMANDS.FEED_LINES(4);
    data += COMMANDS.PARTIAL_CUT;

    return data;
  }

  // Print receipt
  async printReceipt(order: Parameters<typeof this.generateReceiptData>[0], brand: Parameters<typeof this.generateReceiptData>[1]): Promise<boolean> {
    try {
      const data = this.generateReceiptData(order, brand);
      await this.sendData(data);
      return true;
    } catch (error) {
      console.error('Print failed:', error);
      throw error;
    }
  }

  // Open cash drawer (if connected)
  async openCashDrawer(): Promise<void> {
    const command = ESC + 'p' + '\x00' + '\x19' + '\xFA'; // Standard cash drawer kick
    await this.sendData(command);
  }

  // Print test page
  async printTestPage(): Promise<void> {
    let data = COMMANDS.INIT;
    data += COMMANDS.ALIGN_CENTER;
    data += COMMANDS.DOUBLE_SIZE;
    data += 'PRINTER TEST' + LF;
    data += COMMANDS.NORMAL_SIZE;
    data += LF;
    data += 'Connection: ' + this.config.connectionType.toUpperCase() + LF;
    data += 'Paper: ' + this.config.paperWidth + LF;
    data += 'Chars/line: ' + this.getCharWidth() + LF;
    data += this.divider('=');
    data += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + LF;
    data += '0123456789' + LF;
    data += this.divider('-');
    data += COMMANDS.BOLD_ON;
    data += 'Bold Text' + LF;
    data += COMMANDS.BOLD_OFF;
    data += 'Normal Text' + LF;
    data += LF;
    data += 'Test Complete!' + LF;
    data += COMMANDS.FEED_LINES(3);
    data += COMMANDS.PARTIAL_CUT;

    await this.sendData(data);
  }
}

// Export singleton instance
export const thermalPrinter = new ThermalPrinterService();
