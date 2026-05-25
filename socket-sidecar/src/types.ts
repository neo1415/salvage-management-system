import { z } from 'zod';

export type UserRole =
  | 'system_admin'
  | 'salvage_manager'
  | 'finance_officer'
  | 'claims_adjuster'
  | 'vendor';

const uuidSchema = z.string().uuid();
const roomSchema = z.string().regex(
  /^(auction|user|vendor|adjuster):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$|^(admins|fraud:alerts|salvage_managers|auctions:management|finance_officers|payments:management|auctions:all)$/i,
  'Invalid room target'
);
const eventTypeSchema = z.enum([
  'auction:updated',
  'auction:new-bid',
  'auction:extended',
  'auction:closed',
  'auction:watching-count',
  'auction:closing',
  'auction:document-generated',
  'auction:document-generation-complete',
  'vendor:outbid',
  'vendor:won',
  'notification:new',
  'prediction:updated',
  'recommendation:new',
  'recommendation:closing_soon',
  'fraud:alert',
  'schema:new_asset_type',
]);

export interface AuthenticatedSocketUser {
  id: string;
  email?: string;
  role: UserRole;
  vendorId?: string;
}

export const broadcastTargetSchema = z
  .object({
    room: roomSchema.optional(),
    userId: uuidSchema.optional(),
    vendorId: uuidSchema.optional(),
    auctionId: uuidSchema.optional(),
    allAuctions: z.boolean().optional()
  })
  .refine(
    (target) =>
      Boolean(
        target.room ||
          target.userId ||
          target.vendorId ||
          target.auctionId ||
          target.allAuctions
      ),
    'At least one broadcast target is required'
  );

export const internalBroadcastSchema = z.object({
  type: eventTypeSchema,
  target: broadcastTargetSchema,
  payload: z.record(z.string(), z.unknown()).default({})
});

export type InternalBroadcast = z.infer<typeof internalBroadcastSchema>;
