// packages/db/src/supabase/types.ts
// ============================================
// Supabase Generated Types
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      invoices: {
        Row: {
          id: string
          invoice_number: string
          type: 'sale' | 'purchase'
          customer_id: string | null
          supplier_id: string | null
          date: string
          due_date: string | null
          subtotal: number
          discount_total: number
          tax_total: number
          total: number
          paid_amount: number
          currency: string
          payment_method: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
          synced_at: string | null
        }
        Insert: {
          id?: string
          invoice_number: string
          type?: 'sale' | 'purchase'
          customer_id?: string | null
          supplier_id?: string | null
          date?: string
          due_date?: string | null
          subtotal?: number
          discount_total?: number
          tax_total?: number
          total: number
          paid_amount?: number
          currency?: string
          payment_method?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          synced_at?: string | null
        }
        Update: {
          id?: string
          invoice_number?: string
          type?: 'sale' | 'purchase'
          customer_id?: string | null
          supplier_id?: string | null
          date?: string
          due_date?: string | null
          subtotal?: number
          discount_total?: number
          tax_total?: number
          total?: number
          paid_amount?: number
          currency?: string
          payment_method?: string
          status?: string
          notes?: string | null
          created_at?: string
          updated_at?: string
          synced_at?: string | null
        }
      }
      products: {
        Row: {
          id: string
          name: string
          barcode: string
          sku: string
          category: string
          quantity: number
          unit: string
          buy_price: number
          sell_price: number
          wholesale_price: number
          min_stock_level: number
          description: string
          is_active: boolean
          created_at: string
          updated_at: string
          synced_at: string | null
        }
        Insert: {
          id?: string
          name: string
          barcode?: string
          sku?: string
          category?: string
          quantity?: number
          unit?: string
          buy_price?: number
          sell_price?: number
          wholesale_price?: number
          min_stock_level?: number
          description?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          synced_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          barcode?: string
          sku?: string
          category?: string
          quantity?: number
          unit?: string
          buy_price?: number
          sell_price?: number
          wholesale_price?: number
          min_stock_level?: number
          description?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          synced_at?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          full_name: string
          phone: string | null
          email: string | null
          opening_balance: number
          is_active: boolean
          created_at: string
          updated_at: string
          synced_at: string | null
        }
        Insert: {
          id?: string
          full_name: string
          phone?: string | null
          email?: string | null
          opening_balance?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          synced_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string
          phone?: string | null
          email?: string | null
          opening_balance?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
          synced_at?: string | null
        }
      }
      transactions: {
        Row: {
          id: string
          customer_id: string | null
          supplier_id: string | null
          type: string
          amount: number
          currency: string
          description: string | null
          reference: string | null
          date: string
          created_at: string
          synced_at: string | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          supplier_id?: string | null
          type?: string
          amount: number
          currency?: string
          description?: string | null
          reference?: string | null
          date?: string
          created_at?: string
          synced_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          supplier_id?: string | null
          type?: string
          amount?: number
          currency?: string
          description?: string | null
          reference?: string | null
          date?: string
          created_at?: string
          synced_at?: string | null
        }
      }
      workflows: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string | null
          entity_type: string
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string | null
          entity_type: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string | null
          entity_type?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
          deleted_at?: string | null
        }
      }
      workflow_instances: {
        Row: {
          id: string
          workflow_id: string
          workspace_id: string
          entity_type: string
          entity_id: string
          status: string
          current_step: number
          total_steps: number
          started_at: string
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          workspace_id: string
          entity_type: string
          entity_id: string
          status?: string
          current_step?: number
          total_steps: number
          started_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          workspace_id?: string
          entity_type?: string
          entity_id?: string
          status?: string
          current_step?: number
          total_steps?: number
          started_at?: string
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workflow_actions: {
        Row: {
          id: string
          instance_id: string
          step_order: number
          action: string
          actor_user_id: string
          actor_role: string | null
          comment: string | null
          created_at: string
        }
        Insert: {
          id?: string
          instance_id: string
          step_order: number
          action: string
          actor_user_id: string
          actor_role?: string | null
          comment?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          instance_id?: string
          step_order?: number
          action?: string
          actor_user_id?: string
          actor_role?: string | null
          comment?: string | null
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}