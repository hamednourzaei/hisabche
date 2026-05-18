import { Model } from '@nozbe/watermelondb'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

export default class Customer extends Model {
  static table = 'customers'

  @field('full_name') fullName!: string
  @field('phone') phone!: string | undefined
  @field('email') email!: string | undefined
  @field('address') address!: string | undefined
  @field('opening_balance') openingBalance!: number
  @field('is_active') isActive!: boolean
  @field('synced_at') syncedAt!: number | undefined
  @readonly @date('created_at') createdAt!: Date
  @readonly @date('updated_at') updatedAt!: Date
}