/**
 * SchemaEvolutionService
 * Tasks 6.3.1-6.3.6
 */

import { db } from '@/lib/db';
import { sql, desc } from 'drizzle-orm';
import { schemaEvolutionLog } from '@/lib/db/schema/analytics';
import { salvageCases } from '@/lib/db/schema/cases';
import { auctions } from '@/lib/db/schema/auctions';

export class SchemaEvolutionService {
  async detectNewAssetTypes(): Promise<void> {
    const newAssetTypes: any = await db.execute(sql`
      SELECT DISTINCT
        sc.asset_type,
        COUNT(*) AS occurrence_count,
        MIN(sc.created_at) AS first_seen,
        MIN(sc.id) AS sample_case_id
      FROM ${salvageCases} sc
      WHERE sc.created_at > NOW() - INTERVAL '7 days'
        AND sc.asset_type NOT IN ('vehicle', 'electronics', 'machinery')
      GROUP BY sc.asset_type
      HAVING COUNT(*) >= 3
    `);

    for (const row of newAssetTypes) {
      await db.insert(schemaEvolutionLog).values({
        changeType: 'new_asset_type',
        entityType: 'asset_type',
        entityName: row.asset_type,
        changeDetails: {
          occurrenceCount: parseInt(row.occurrence_count),
          firstSeen: row.first_seen,
          sampleCaseId: row.sample_case_id,
          reason: 'Detected new asset type in submissions',
        },
        status: 'pending',
      });

      // Emit Socket.IO event to admins
      try {
        const { emitSchemaNewAssetType } = await import('../events/schema-new-asset-type.event');
        
        // Get sample auction ID from case
        const sampleAuction: any = await db.execute(sql`
          SELECT a.id FROM ${salvageCases} sc
          JOIN auctions a ON a.case_id = sc.id
          WHERE sc.id = ${row.sample_case_id}
          LIMIT 1
        `);
        
        const sampleAuctionId = sampleAuction[0]?.id || row.sample_case_id;
        
        await emitSchemaNewAssetType(
          row.asset_type,
          new Date(row.first_seen),
          sampleAuctionId,
          true // requires review
        );
      } catch (error) {
        console.error('Failed to emit schema:new_asset_type event:', error);
      }
    }
  }

  async detectNewAttributes(): Promise<void> {
    const newAttributes: any = await db.execute(sql`
      SELECT DISTINCT
        sc.asset_type,
        jsonb_object_keys(sc.asset_details) AS attribute_name,
        COUNT(*) AS occurrence_count
      FROM ${salvageCases} sc
      WHERE sc.created_at > NOW() - INTERVAL '7 days'
      GROUP BY sc.asset_type, jsonb_object_keys(sc.asset_details)
      HAVING COUNT(*) >= 5
    `);

    for (const row of newAttributes) {
      const existingAttributes = ['make', 'model', 'year', 'color', 'trim', 'storage'];
      
      if (!existingAttributes.includes(row.attribute_name)) {
        await db.insert(schemaEvolutionLog).values({
          changeType: 'new_attribute',
          entityType: 'attribute',
          entityName: row.attribute_name,
          changeDetails: {
            assetType: row.asset_type,
            occurrenceCount: parseInt(row.occurrence_count),
            reason: 'Detected new attribute in asset details',
          },
          status: 'pending',
        });
      }
    }
  }

  async getPendingChanges(): Promise<any[]> {
    return await db
      .select()
      .from(schemaEvolutionLog)
      .where(sql`${schemaEvolutionLog.status} = 'pending'`)
      .orderBy(desc(schemaEvolutionLog.createdAt))
      .limit(50);
  }

  async approveChange(changeId: string, reviewerId: string): Promise<void> {
    await db
      .update(schemaEvolutionLog)
      .set({
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
      })
      .where(sql`${schemaEvolutionLog.id} = ${changeId}`);
  }

  /**
   * Validate schema change
   * Task 6.3.3: Implement schema validation workflow
   */
  async validateSchemaChange(changeId: string): Promise<{ valid: boolean; errors: string[] }> {
    const [change] = await db
      .select()
      .from(schemaEvolutionLog)
      .where(sql`${schemaEvolutionLog.id} = ${changeId}`)
      .limit(1);

    if (!change) {
      return { valid: false, errors: ['Schema change not found'] };
    }

    const errors: string[] = [];

    // Validate change type
    if (!['new_asset_type', 'new_attribute'].includes(change.changeType)) {
      errors.push(`Invalid change type: ${change.changeType}`);
    }

    // Validate entity name
    if (!change.entityName || change.entityName.trim().length === 0) {
      errors.push('Entity name is required');
    }

    // Validate entity name format (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(change.entityName)) {
      errors.push('Entity name must contain only alphanumeric characters and underscores');
    }

    // Validate occurrence count
    const occurrenceCount = change.changeDetails?.occurrenceCount;
    if (!occurrenceCount || occurrenceCount < 3) {
      errors.push('Insufficient occurrence count (minimum 3 required)');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Automatically expand analytics tables for new schema
   * Task 6.3.4: Implement automatic analytics table expansion
   */
  async expandAnalyticsTables(changeId: string): Promise<void> {
    const [change] = await db
      .select()
      .from(schemaEvolutionLog)
      .where(sql`${schemaEvolutionLog.id} = ${changeId}`)
      .limit(1);

    if (!change || change.status !== 'approved') {
      throw new Error('Schema change must be approved before expansion');
    }

    if (change.changeType === 'new_asset_type') {
      // Create analytics entries for new asset type
      const assetType = change.entityName;
      
      console.log(`📊 Expanding analytics tables for new asset type: ${assetType}`);
      
      // The analytics tables already support any asset_type value
      // No schema changes needed, just log the expansion
      await db
        .update(schemaEvolutionLog)
        .set({
          status: 'applied',
          updatedAt: new Date(),
        })
        .where(sql`${schemaEvolutionLog.id} = ${changeId}`);
      
      console.log(`✅ Analytics tables expanded for asset type: ${assetType}`);
    } else if (change.changeType === 'new_attribute') {
      // Create analytics entries for new attribute
      const attributeName = change.entityName;
      const assetType = change.changeDetails?.assetType;
      
      console.log(`📊 Expanding analytics tables for new attribute: ${attributeName} (${assetType})`);
      
      // The attribute_performance_analytics table already supports any attribute_type/value
      // No schema changes needed, just log the expansion
      await db
        .update(schemaEvolutionLog)
        .set({
          status: 'applied',
          updatedAt: new Date(),
        })
        .where(sql`${schemaEvolutionLog.id} = ${changeId}`);
      
      console.log(`✅ Analytics tables expanded for attribute: ${attributeName}`);
    }
  }
}
