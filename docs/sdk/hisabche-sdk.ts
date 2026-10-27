// ============================================
// Hisabche Developer TypeScript SDK (Generated)
// API Version: 1.0.0
// ============================================

export interface HisabcheClientConfig {
  baseUrl?: string
  apiKey: string
}

export class HisabcheClient {
  private baseUrl: string
  private apiKey: string

  constructor(config: HisabcheClientConfig) {
    this.baseUrl = (config.baseUrl || 'https://api.hisabche.com').replace(/\/+$/, '')
    this.apiKey = config.apiKey
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    }

    const res = await fetch(url, { ...options, headers })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }))
      throw new Error(`Hisabche API Error [${res.status}]: ${JSON.stringify(err)}`)
    }
    return res.json() as Promise<T>
  }

  // Customers API
  readonly customers = {
    list: (params?: { limit?: number; offset?: number }) =>
      this.request<{ data: any[] }>(`/api/customers`),
    get: (id: string) => this.request<any>(`/api/customers/${id}`),
  }

  // Invoices API
  readonly invoices = {
    list: (params?: { limit?: number }) => this.request<{ data: any[] }>(`/api/invoices`),
    get: (id: string) => this.request<any>(`/api/invoices/${id}`),
  }

  // Catalog API
  readonly products = {
    list: () => this.request<{ data: any[] }>(`/api/products`),
    get: (id: string) => this.request<any>(`/api/products/${id}`),
  }
}
