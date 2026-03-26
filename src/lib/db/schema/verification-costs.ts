import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core';
import { vendors } from './vendors';

export const verificationCosts = pgTable('verification_costs', {
  id: uuid('id').primaryKey().defaultRandom(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id, { onDelete: 'cascade' }),
  verificationType: varchar('verification_type', { length: 50 }).notNull(),
  costAmount: numeric('cost_amount', { precision: 10, scale: 2 }).notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('NGN'),
  dojahReferenceId: varchar('dojah_reference_id', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
