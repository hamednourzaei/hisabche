import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Product extends Model {
  static table = 'products'

  @field('name') name!: string
  @field('barcode') barcode!: string | undefined
  @field('sku') sku!: string | undefined
  @field('category') category!: string
  @field('quantity') quantity!: number
  @field('unit') unit!: string
  @field('buy_price') buyPrice!: number
  @field('sell_price') sellPrice!: number
  @field('wholesale_price') wholesalePrice!: number | undefined
  @field('min_stock_level') minStockLevel!: number
  @field('description') description!: string | undefined
  @field('is_active') isActive!: boolean
  @field('synced_at') syncedAt!: number | undefined
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}