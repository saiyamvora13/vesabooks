
interface ProdigiAddress {
  line1: string;
  line2?: string;
  postalOrZipCode: string;
  countryCode: string;
  townOrCity: string;
  stateOrCounty?: string;
}

interface ProdigiRecipient {
  name: string;
  email?: string;
  phoneNumber?: string;
  address: ProdigiAddress;
}

interface ProdigiAsset {
  printArea: string;
  url: string;
}

interface ProdigiItem {
  sku: string;
  copies: number;
  sizing: string;
  assets: ProdigiAsset[];
}

interface CreateOrderRequest {
  merchantReference: string;
  shippingMethod: 'Budget' | 'Standard' | 'Express' | 'Overnight';
  recipient: ProdigiRecipient;
  items: ProdigiItem[];
  callbackUrl?: string;
  metadata?: Record<string, any>;
}

interface ProdigiOrder {
  id: string;
  created: string;
  status: {
    stage: string;
    details: Record<string, string>;
  };
  charges: Array<{
    id: string;
    prodigiInvoiceNumber: string;
    totalCost: {
      amount: string;
      currency: string;
    };
  }>;
  shipments: Array<{
    carrier: {
      name: string;
      service: string;
    };
    tracking: {
      number: string;
      url: string;
    };
    dispatchDate: string;
    estimatedDeliveryDate?: string;
  }>;
}

interface QuoteRequest {
  shippingMethod: 'Budget' | 'Standard' | 'Express' | 'Overnight';
  destinationCountryCode: string;
  items: Array<{
    sku: string;
    copies: number;
  }>;
}

interface QuoteResponse {
  quotes: Array<{
    costSummary: {
      items: {
        amount: string;
        currency: string;
      };
      shipping: {
        amount: string;
        currency: string;
      };
      total: {
        amount: string;
        currency: string;
      };
    };
  }>;
}

export class ProdigiService {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.PRODIGI_SANDBOX_API_KEY || '';
    this.baseUrl = 'https://api.sandbox.prodigi.com/v4.0';
    
    if (!this.apiKey) {
      console.warn('[Prodigi] Warning: PRODIGI_SANDBOX_API_KEY not set');
    }
  }

  private async makeRequest<T>(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: any = {
      method,
      headers: {
        'X-API-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`[Prodigi] ${method} ${url}`);
    
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      console.error('[Prodigi] API Error:', data);
      throw new Error(`Prodigi API error: ${response.status} - ${JSON.stringify(data)}`);
    }

    return data as T;
  }

  async getQuote(request: QuoteRequest): Promise<QuoteResponse> {
    return this.makeRequest<QuoteResponse>('/quotes', 'POST', request);
  }

  async createOrder(request: CreateOrderRequest): Promise<ProdigiOrder> {
    const response = await this.makeRequest<{ order: ProdigiOrder }>('/orders', 'POST', request);
    return response.order;
  }

  async getOrder(orderId: string): Promise<ProdigiOrder> {
    const response = await this.makeRequest<{ order: ProdigiOrder }>(`/orders/${orderId}`);
    return response.order;
  }

  async getOrders(params?: { top?: number; skip?: number }): Promise<{ orders: ProdigiOrder[] }> {
    const queryParams = new URLSearchParams();
    if (params?.top) queryParams.append('top', params.top.toString());
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    
    const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return this.makeRequest<{ orders: ProdigiOrder[] }>(`/orders${query}`);
  }

  async cancelOrder(orderId: string): Promise<void> {
    await this.makeRequest(`/orders/${orderId}/actions/cancel`, 'POST');
  }

  async getProduct(sku: string): Promise<any> {
    return this.makeRequest<any>(`/products/${sku}`);
  }

  getProductSKU(bookSize: string, pageCount: number): string {
    const normalizedSize = bookSize.toLowerCase();
    
    // Hardcover books with gloss finish (HARD-G)
    if (normalizedSize.includes('a5') && normalizedSize.includes('portrait')) {
      return 'BOOK-FE-A5-P-HARD-G';
    } else if (normalizedSize.includes('a5') && normalizedSize.includes('landscape')) {
      return 'BOOK-FE-A5-L-HARD-G';
    } else if (normalizedSize.includes('a4') && normalizedSize.includes('portrait')) {
      return 'BOOK-FE-A4-P-HARD-G';
    } else if (normalizedSize.includes('a4') && normalizedSize.includes('landscape')) {
      return 'BOOK-FE-A4-L-HARD-G';
    }
    
    // Default to A5 Portrait hardcover
    return 'BOOK-FE-A5-P-HARD-G';
  }

  calculateBookDimensions(bookSize: string): { width: number; height: number } {
    const normalizedSize = bookSize.toLowerCase();
    
    if (normalizedSize.includes('a5-portrait')) {
      return { width: 148, height: 210 };
    } else if (normalizedSize.includes('a5-landscape')) {
      return { width: 210, height: 148 };
    } else if (normalizedSize.includes('a4-portrait')) {
      return { width: 210, height: 297 };
    } else if (normalizedSize.includes('a4-landscape')) {
      return { width: 297, height: 210 };
    }
    
    return { width: 148, height: 210 };
  }
}

export const prodigiService = new ProdigiService();
