import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('store_shipping_settings')
export class StoreShippingSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ─── الربط مع المستخدم (المالك) ─── (raw FK only — User lives in the api project)
  @Column({ name: 'user_id' })
  userId: string;

  // ─── الربط مع المتجر (السياق) ─── (raw FK only — Store lives in the api project)
  @Column({ name: 'store_id', nullable: true })
  storeId?: string;

  // ─── بيانات الحساب ───
  @Column({ name: 'account_name', length: 128 })
  accountName: string;

  @Column({ name: 'provider_name', length: 64 })
  providerName: string;

  @Column({ name: 'credentials', type: 'text' })
  credentials: string;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // ─── دوال مساعدة ───
  getParsedCredentials(): Record<string, string> {
    return JSON.parse(this.credentials);
  }

  setCredentials(creds: Record<string, string>): void {
    this.credentials = JSON.stringify(creds);
  }
}
