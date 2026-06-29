/**
 * Query Builder Service for Universal Internet Search
 * 
 * This service constructs intelligent search queries for different item types
 * and search scenarios, optimized for Nigerian market conditions.
 */

import {
  resolveMarketSearchCondition,
  isUniversalMarketSearchCondition,
  isBrandNewMarketRealistic,
} from '@/features/valuations/services/condition-mapping.service';

// Types for different item categories
export interface VehicleIdentifier {
  type: 'vehicle';
  make: string;
  model: string;
  year?: number;
  mileage?: number;
  condition?: UniversalCondition;
}

export interface ElectronicsIdentifier {
  type: 'electronics';
  brand: string;
  model: string;
  storage?: string; // Legacy field for backward compatibility
  storageCapacity?: string; // e.g., "256GB", "512GB", "1TB"
  storageType?: string; // e.g., "SSD", "HDD", "NVMe", "eUFS"
  color?: string;
  condition?: UniversalCondition;
}


export interface ApplianceIdentifier {
  type: 'appliance';
  brand: string;
  model: string;
  size?: string;
  condition?: UniversalCondition;
}

export interface PropertyIdentifier {
  type: 'property';
  propertyType: string;
  location: string;
  bedrooms?: number;
  condition?: UniversalCondition;
}

export interface JewelryIdentifier {
  type: 'jewelry';
  jewelryType: string;
  brand?: string;
  material?: string;
  weight?: string;
  condition?: UniversalCondition;
}

export interface FurnitureIdentifier {
  type: 'furniture';
  furnitureType: string;
  brand?: string;
  material?: string;
  size?: string;
  condition?: UniversalCondition;
}

export interface MachineryIdentifier {
  type: 'machinery';
  brand: string;
  machineryType: string;
  model?: string;
  year?: number;
  condition?: UniversalCondition;
}

export interface BulkGoodsIdentifier {
  type: 'stock' | 'goods_in_transit' | 'building_materials' | 'scrap' | 'agriculture';
  description?: string;
  brand?: string;
  model?: string;
  quantity?: string;
  unitOfMeasure?: string;
  packagingType?: string;
}

export interface SpecialEquipmentIdentifier {
  type: 'equipment' | 'medical_equipment' | 'energy_equipment' | 'aviation_equipment' | 'other';
  description?: string;
  brand?: string;
  model?: string;
  quantity?: string;
  unitOfMeasure?: string;
  year?: number;
  condition?: UniversalCondition;
}

export type ItemIdentifier = 
  | VehicleIdentifier 
  | ElectronicsIdentifier 
  | ApplianceIdentifier 
  | PropertyIdentifier
  | JewelryIdentifier
  | FurnitureIdentifier
  | MachineryIdentifier
  | BulkGoodsIdentifier
  | SpecialEquipmentIdentifier;

export interface PartIdentifier {
  vehicleMake: string;
  vehicleModel?: string;
  vehicleYear?: number;
  partName: string;
  partType: 'body' | 'mechanical' | 'electrical' | 'interior';
  damageLevel: 'minor' | 'moderate' | 'severe';
}

export type UniversalCondition = 
  | 'Brand New'
  | 'Foreign Used (Tokunbo)'
  | 'Nigerian Used'
  | 'Heavily Used';

// Condition mapping to search terms
const CONDITION_SEARCH_TERMS: Record<UniversalCondition, string[]> = {
  'Brand New': ['brand new', 'new', 'unused'],
  'Foreign Used (Tokunbo)': ['tokunbo', 'foreign used', 'uk used', 'us used', 'clean'],
  'Nigerian Used': ['nigerian used', 'locally used', 'naija used'],
  'Heavily Used': ['fairly used', 'old', 'used', 'cheap']
};

function conditionSearchTermsForAsset(condition: UniversalCondition, assetType: ItemIdentifier['type']): string[] {
  if (condition === 'Brand New' || assetType === 'vehicle') return CONDITION_SEARCH_TERMS[condition];
  if (condition === 'Foreign Used (Tokunbo)') {
    if (assetType === 'electronics' || assetType === 'appliance') return ['foreign used', 'uk used', 'clean used'];
    if (assetType === 'jewelry') return ['pre-owned', 'used excellent condition'];
    if (assetType === 'property') return ['good condition', 'well maintained'];
    return ['used good condition', 'clean used'];
  }
  if (condition === 'Nigerian Used') {
    return assetType === 'property'
      ? ['fair condition', 'requires minor repairs']
      : ['used fair condition', 'locally used'];
  }
  return assetType === 'property'
    ? ['poor condition', 'requires renovation']
    : ['used poor condition', 'as-is'];
}

// Quality tier to condition mapping for backward compatibility
const QUALITY_TO_CONDITION_MAPPING: Record<string, UniversalCondition> = {
  'excellent': 'Brand New',
  'good': 'Foreign Used (Tokunbo)',
  'fair': 'Nigerian Used',
  'poor': 'Heavily Used',
  // Also support the correct condition values
  'Brand New': 'Brand New',
  'Foreign Used (Tokunbo)': 'Foreign Used (Tokunbo)',
  'Nigerian Used': 'Nigerian Used',
  'Heavily Used': 'Heavily Used'
};

/**
 * Normalize condition to a valid UniversalCondition
 */
function normalizeCondition(condition: string): UniversalCondition | null {
  const normalized = QUALITY_TO_CONDITION_MAPPING[condition];
  return normalized || null;
}

// Location-specific search terms
const LOCATION_TERMS = {
  nigeria: ['Nigeria', 'Lagos', 'Abuja', 'Port Harcourt', 'Kano', 'Ibadan'],
  global: ['price', 'cost', 'buy', 'sell']
};

// Marketplace-specific terms
const MARKETPLACE_TERMS = [
  'jiji.ng', 'cars45', 'cheki', 'olx', 'jumia', 'konga', 'autochek'
];

export class QueryBuilderService {
  
  /**
   * Build market price search query for any item type
   */
  buildMarketQuery(item: ItemIdentifier, options: {
    includeCondition?: boolean;
    includeLocation?: boolean;
    includeMarketplace?: boolean;
  } = {}): string {
    const { includeCondition = true, includeLocation = true, includeMarketplace = false } = options;
    
    let query = '';
    
    // Build base query based on item type
    switch (item.type) {
      case 'vehicle':
        query = this.buildVehicleQuery(item);
        break;
      case 'electronics':
        query = this.buildElectronicsQuery(item);
        break;
      case 'appliance':
        query = this.buildApplianceQuery(item);
        break;
      case 'property':
        query = this.buildPropertyQuery(item);
        break;
      case 'jewelry':
        query = this.buildJewelryQuery(item);
        break;
      case 'furniture':
        query = this.buildFurnitureQuery(item);
        break;
      case 'machinery':
        query = this.buildMachineryQuery(item);
        break;
      case 'stock':
      case 'goods_in_transit':
      case 'building_materials':
      case 'scrap':
      case 'agriculture':
        query = this.buildBulkGoodsQuery(item);
        break;
      case 'equipment':
      case 'medical_equipment':
      case 'energy_equipment':
      case 'aviation_equipment':
      case 'other':
        query = this.buildSpecialEquipmentQuery(item);
        break;
      default:
        throw new Error(`Unsupported item type: ${(item as any).type}`);
    }
    
    // Add condition terms — search the realistic condition directly (no post-search multipliers)
    if (includeCondition && 'condition' in item && item.condition) {
      const assetYear = item.type === 'vehicle' || item.type === 'machinery' ? item.year : undefined;
      const model = 'model' in item ? item.model : undefined;
      let searchCondition: string;
      if (isUniversalMarketSearchCondition(item.condition)) {
        searchCondition = item.condition;
        if (
          searchCondition === 'Brand New' &&
          !isBrandNewMarketRealistic({ assetType: item.type, year: assetYear, model })
        ) {
          searchCondition = 'Foreign Used (Tokunbo)';
        }
      } else {
        searchCondition = resolveMarketSearchCondition(item.condition, {
          assetType: item.type,
          vehicleYear: assetYear,
          year: assetYear,
          model,
        });
      }
      const conditionTerms = conditionSearchTermsForAsset(searchCondition as UniversalCondition, item.type);
      if (conditionTerms && conditionTerms.length > 0) {
        query += ` ${conditionTerms[0]}`;
        console.log(`🔍 Including condition in search: "${conditionTerms[0]}" for ${searchCondition} (user: ${item.condition})`);
      }
    }
    
    // Add price and location terms
    query += ' price';
    
    if (includeLocation) {
      query += ' Nigeria';
    }
    
    // Add marketplace terms for more specific results
    if (includeMarketplace) {
      query += ` site:${MARKETPLACE_TERMS[0]}`;
    }
    
    return this.sanitizeQuery(query);
  }

  /**
   * Build part price search query for salvage calculations (simplified interface)
   */
  buildPartPriceQuery(
    item: ItemIdentifier, 
    partName: string, 
    damageType?: string
  ): string {
    const normalizedPart = partName.trim();
    const damageContext = damageType ? ` ${damageType}` : '';

    switch (item.type) {
      case 'vehicle':
        return this.buildPartQuery({
          vehicleMake: item.make,
          vehicleModel: item.model,
          vehicleYear: item.year,
          partName: normalizedPart,
          partType: this.mapDamageTypeToPartType(damageType),
          damageLevel: 'moderate'
        });

      case 'electronics':
        return this.sanitizeQuery(
          `${this.buildElectronicsQuery(item)} ${normalizedPart}${damageContext} replacement repair price Nigeria`
        );

      case 'appliance':
        return this.sanitizeQuery(
          `${this.buildApplianceQuery(item)} ${normalizedPart}${damageContext} spare part repair price Nigeria`
        );

      case 'property':
        return this.sanitizeQuery(
          `${this.buildPropertyQuery(item)} ${normalizedPart}${damageContext} repair replacement cost Nigeria`
        );

      case 'jewelry':
        return this.sanitizeQuery(
          `${this.buildJewelryQuery(item)} ${normalizedPart}${damageContext} repair replacement cost Nigeria`
        );

      case 'furniture':
        return this.sanitizeQuery(
          `${this.buildFurnitureQuery(item)} ${normalizedPart}${damageContext} repair replacement price Nigeria`
        );

      case 'machinery':
        return this.sanitizeQuery(
          `${this.buildMachineryQuery(item)} ${normalizedPart}${damageContext} spare part replacement repair price Nigeria`
        );

      case 'stock':
      case 'goods_in_transit':
      case 'building_materials':
      case 'agriculture':
        return this.sanitizeQuery(
          `${this.buildBulkGoodsQuery(item)} ${normalizedPart}${damageContext} damaged stock recoverable resale value Nigeria`
        );

      case 'scrap':
        return this.sanitizeQuery(
          `${this.buildBulkGoodsQuery(item)} ${normalizedPart}${damageContext} scrap value price per kg Nigeria`
        );

      case 'equipment':
      case 'medical_equipment':
      case 'energy_equipment':
      case 'aviation_equipment':
      case 'other':
        return this.sanitizeQuery(
          `${this.buildSpecialEquipmentQuery(item)} ${normalizedPart}${damageContext} spare part replacement repair price Nigeria`
        );

      default:
        return this.sanitizeQuery(`${normalizedPart}${damageContext} replacement repair price Nigeria`);
    }
  }

  /**
   * Map damage type to part type
   */
  private mapDamageTypeToPartType(damageType?: string): 'body' | 'mechanical' | 'electrical' | 'interior' {
    if (!damageType) return 'body';
    
    const lowerDamageType = damageType.toLowerCase();
    
    if (lowerDamageType.includes('glass') || lowerDamageType.includes('body') || lowerDamageType.includes('paint')) {
      return 'body';
    } else if (lowerDamageType.includes('engine') || lowerDamageType.includes('transmission') || lowerDamageType.includes('brake')) {
      return 'mechanical';
    } else if (lowerDamageType.includes('light') || lowerDamageType.includes('electrical') || lowerDamageType.includes('battery')) {
      return 'electrical';
    } else if (lowerDamageType.includes('seat') || lowerDamageType.includes('interior') || lowerDamageType.includes('dashboard')) {
      return 'interior';
    }
    
    return 'body'; // Default to body parts
  }

  /**
   * Build part price search query for salvage calculations
   */
  buildPartQuery(part: PartIdentifier, options: {
    includeYear?: boolean;
    includeLocation?: boolean;
  } = {}): string {
    const { includeYear = true, includeLocation = true } = options;
    
    let query = `${part.vehicleMake}`;
    
    // Add model if available
    if (part.vehicleModel) {
      query += ` ${part.vehicleModel}`;
    }
    
    // Add year if available and requested
    if (includeYear && part.vehicleYear) {
      query += ` ${part.vehicleYear}`;
    }
    
    // Add part name
    query += ` ${part.partName}`;
    
    // Add part type context for better results
    if (part.partType === 'body') {
      query += ' body part';
    } else if (part.partType === 'mechanical') {
      query += ' spare part';
    }
    
    // Add price and location
    query += ' price';
    
    if (includeLocation) {
      query += ' Nigeria';
    }
    
    return this.sanitizeQuery(query);
  }

  /**
   * Build condition-specific query variations
   */
  buildConditionQuery(baseQuery: string, condition: UniversalCondition, assetType: ItemIdentifier['type'] = 'vehicle'): string[] {
    const normalizedCondition = normalizeCondition(condition);
    if (!normalizedCondition) {
      // Return base query without condition if condition not supported
      return [this.sanitizeQuery(`${baseQuery} price Nigeria`)];
    }
    
    const conditionTerms = conditionSearchTermsForAsset(normalizedCondition, assetType);
    if (!conditionTerms || conditionTerms.length === 0) {
      // Return base query without condition if condition not supported
      return [this.sanitizeQuery(`${baseQuery} price Nigeria`)];
    }
    
    return conditionTerms.map(term => 
      this.sanitizeQuery(`${baseQuery} ${term} price Nigeria`)
    );
  }

  /**
   * Localize query for specific regions
   */
  localizeQuery(query: string, location: 'nigeria' | 'global' = 'nigeria'): string {
    const locationTerms = LOCATION_TERMS[location];
    const randomTerm = locationTerms[Math.floor(Math.random() * locationTerms.length)];
    
    return this.sanitizeQuery(`${query} ${randomTerm}`);
  }

  /**
   * Generate multiple query variations for better coverage
   */
  generateQueryVariations(item: ItemIdentifier, maxVariations: number = 3): string[] {
    const variations: string[] = [];
    
    // Base query
    variations.push(this.buildMarketQuery(item));
    
    // Condition-specific variations
    if ('condition' in item && item.condition && variations.length < maxVariations) {
      const conditionQueries = this.buildConditionQuery(
        this.getBaseItemQuery(item), 
        item.condition,
        item.type
      );
      variations.push(...conditionQueries.slice(0, maxVariations - variations.length));
    }
    
    // Marketplace-specific variation
    if (variations.length < maxVariations) {
      variations.push(this.buildMarketQuery(item, { includeMarketplace: true }));
    }

    for (const query of this.buildAssetSpecificVariations(item)) {
      if (variations.length >= maxVariations) break;
      if (!variations.includes(query)) variations.push(query);
    }
    
    return variations.slice(0, maxVariations);
  }

  // Private helper methods
  
  private buildVehicleQuery(vehicle: VehicleIdentifier): string {
    let query = `${vehicle.make} ${vehicle.model}`;
    
    if (vehicle.year) {
      query += ` ${vehicle.year}`;
    }
    
    // Add specific terms for luxury vehicles to get better pricing results
    const luxuryBrands = ['lamborghini', 'ferrari', 'mclaren', 'bugatti', 'koenigsegg', 'pagani', 'rolls-royce', 'bentley'];
    const isLuxuryBrand = luxuryBrands.some(brand => 
      vehicle.make.toLowerCase().includes(brand)
    );
    
    if (isLuxuryBrand) {
      query += ' supercar luxury';
    }
    
    return query;
  }

  private buildElectronicsQuery(electronics: ElectronicsIdentifier): string {
    let query = `${electronics.brand} ${electronics.model}`;
    
    // Enhanced storage handling with type differentiation
    if (electronics.storageCapacity || electronics.storageType) {
      // Use new separate fields for better precision
      if (electronics.storageCapacity) {
        query += ` ${electronics.storageCapacity}`;
      }
      if (electronics.storageType) {
        query += ` ${electronics.storageType}`;
      }
    } else if (electronics.storage) {
      // Fallback to legacy storage field for backward compatibility
      query += ` ${electronics.storage}`;
    }
    
    if (electronics.color) {
      query += ` ${electronics.color}`;
    }
    
    return query;
  }

  private buildApplianceQuery(appliance: ApplianceIdentifier): string {
    let query = `${appliance.brand} ${appliance.model}`;
    
    if (appliance.size) {
      query += ` ${appliance.size}`;
    }
    
    return query;
  }

  private buildPropertyQuery(property: PropertyIdentifier): string {
    let query = `${property.propertyType}`;
    
    if (property.bedrooms) {
      query += ` ${property.bedrooms} bedroom`;
    }
    
    query += ` ${property.location}`;
    
    return query;
  }

  private buildJewelryQuery(jewelry: JewelryIdentifier): string {
    let query = `${jewelry.jewelryType}`;
    
    if (jewelry.brand) {
      query += ` ${jewelry.brand}`;
    }
    
    if (jewelry.material) {
      query += ` ${jewelry.material}`;
    }
    
    if (jewelry.weight) {
      query += ` ${jewelry.weight}`;
    }
    
    return query;
  }

  private buildFurnitureQuery(furniture: FurnitureIdentifier): string {
    let query = `${furniture.furnitureType}`;
    
    if (furniture.brand) {
      query += ` ${furniture.brand}`;
    }
    
    if (furniture.material) {
      query += ` ${furniture.material}`;
    }
    
    if (furniture.size) {
      query += ` ${furniture.size}`;
    }

    const furnitureText = `${furniture.furnitureType} ${furniture.size || ''}`.toLowerCase();
    const furnitureGroups = [
      /\b(sofa|couch|settee)\b/,
      /\b(armchair|chair|recliner)\b/,
      /\b(coffee\s+table|table)\b/,
      /\b(cabinet|sideboard|console|shelf|shelving)\b/,
      /\b(wardrobe|bed|dresser)\b/,
    ].filter((pattern) => pattern.test(furnitureText)).length;
    if (furnitureGroups >= 2 && !/\b(set|suite|complete)\b/.test(furnitureText)) {
      query += ' complete set';
    }
    
    return query;
  }

  private buildMachineryQuery(machinery: MachineryIdentifier): string {
    let query = `${machinery.brand}`;
    
    if (machinery.model) {
      query += ` ${machinery.model}`;
    }
    
    if (machinery.year) {
      query += ` ${machinery.year}`;
    }
    
    // Add machinery type
    query += ` ${machinery.machineryType}`;
    
    // Add specific terms for heavy equipment brands to get better pricing results
    const heavyEquipmentBrands = ['caterpillar', 'cat', 'komatsu', 'volvo', 'hitachi', 'jcb', 'liebherr', 'doosan', 'hyundai'];
    const isHeavyEquipment = heavyEquipmentBrands.some(brand => 
      machinery.brand.toLowerCase().includes(brand)
    );
    
    if (isHeavyEquipment) {
      // Prioritize Nigerian marketplaces for heavy equipment
      query += ' price Nigeria site:jiji.ng OR site:cheki.ng';
    }
    
    return query;
  }

  private getBaseItemQuery(item: ItemIdentifier): string {
    switch (item.type) {
      case 'vehicle':
        return this.buildVehicleQuery(item);
      case 'electronics':
        return this.buildElectronicsQuery(item);
      case 'appliance':
        return this.buildApplianceQuery(item);
      case 'property':
        return this.buildPropertyQuery(item);
      case 'jewelry':
        return this.buildJewelryQuery(item);
      case 'furniture':
        return this.buildFurnitureQuery(item);
      case 'machinery':
        return this.buildMachineryQuery(item);
      case 'stock':
      case 'goods_in_transit':
      case 'building_materials':
      case 'scrap':
      case 'agriculture':
        return this.buildBulkGoodsQuery(item);
      case 'equipment':
      case 'medical_equipment':
      case 'energy_equipment':
      case 'aviation_equipment':
      case 'other':
        return this.buildSpecialEquipmentQuery(item);
      default:
        return '';
    }
  }

  private buildBulkGoodsQuery(item: BulkGoodsIdentifier): string {
    const identityTerms =
      item.type === 'scrap'
        ? [item.brand, this.stripBulkNarrative(item.model), this.stripBulkNarrative(item.description)]
        : [item.brand, this.stripBulkNarrative(item.model), item.packagingType];

    const base = this.dedupeSearchTerms(this.compactTerms(identityTerms));
    const normalizedBase = base || item.type.replace(/_/g, ' ');
    const lower = normalizedBase.toLowerCase();
    const hasBagUnit = /\b(bags?|sacks?)\b/.test(lower);
    const looksLikeDangoteCement =
      /\bdangote\b/.test(lower)
      && hasBagUnit
      && !/\b(sugar|flour|rice|salt|pasta|noodles|feed)\b/.test(lower);

    if (item.type === 'scrap' || /\b(scrap|copper|aluminium|aluminum)\b/.test(lower)) {
      return `${normalizedBase} scrap metal price per kg tonne Nigeria`;
    }

    if (looksLikeDangoteCement || /\bcement\b/.test(lower)) {
      const cementBase = /\bcement\b/.test(lower) ? normalizedBase : `${normalizedBase} cement`;
      const weightHint = /\b(25|50)\s*kg\b/.test(lower) ? '' : ' 50kg';
      return `${cementBase}${weightHint} bag cement retail wholesale`;
    }

    if (item.type === 'building_materials' || /\b(roofing|tiles?|paint|blocks?|steel|rebar|iron rods?|plywood|plumbing|electrical cable)\b/.test(lower)) {
      return `${normalizedBase} building material unit price retail wholesale`;
    }

    if (item.type === 'agriculture' || /\b(rice|maize|beans|cassava|yam|grain|feed|fertilizer|seed|produce|livestock)\b/.test(lower)) {
      return `${normalizedBase} agricultural produce commodity market price per kg bag tonne`;
    }

    if (item.type === 'goods_in_transit') {
      return `${normalizedBase} cargo goods wholesale market value replacement cost`;
    }

    return `${normalizedBase} wholesale retail market value`;
  }

  private buildSpecialEquipmentQuery(item: SpecialEquipmentIdentifier): string {
    const description = this.compactTerms([
      item.brand,
      this.stripBulkNarrative(item.model),
      this.stripBulkNarrative(item.description),
    ]);
    const base = description || item.type.replace(/_/g, ' ');

    if (item.type === 'medical_equipment') {
      return `${base} medical equipment used`;
    }

    if (item.type === 'energy_equipment') {
      return `${base} industrial energy oil gas equipment`;
    }

    if (item.type === 'aviation_equipment') {
      return `${base} aviation ground support equipment aircraft part`;
    }

    return `${base} equipment used`;
  }

  private buildAssetSpecificVariations(item: ItemIdentifier): string[] {
    switch (item.type) {
      case 'building_materials': {
        const base = this.buildBulkGoodsQuery(item);
        return [
          this.sanitizeQuery(`${base} Nigeria supplier price`),
          this.sanitizeQuery(`${base} Lagos price`),
          this.sanitizeQuery(`${base} site:buildingsandmoreng.com`),
        ];
      }
      case 'stock':
      case 'goods_in_transit':
        return [
          this.sanitizeQuery(`${this.buildBulkGoodsQuery(item)} Nigeria distributor price`),
          this.sanitizeQuery(`${this.buildBulkGoodsQuery(item)} Nigeria wholesale price`),
        ];
      case 'agriculture':
        return [
          this.sanitizeQuery(`${this.buildBulkGoodsQuery(item)} Nigeria market price today`),
          this.sanitizeQuery(`${this.buildBulkGoodsQuery(item)} Lagos commodity price`),
        ];
      case 'scrap':
        return [
          this.sanitizeQuery(`${this.buildBulkGoodsQuery(item)} Nigeria scrap dealer`),
          this.sanitizeQuery(`${this.buildBulkGoodsQuery(item)} Lagos scrap price`),
        ];
      case 'medical_equipment':
      case 'energy_equipment':
      case 'aviation_equipment':
      case 'equipment':
      case 'other':
        return [
          this.sanitizeQuery(`${this.buildSpecialEquipmentQuery(item)} Nigeria used`),
          this.sanitizeQuery(`${this.buildSpecialEquipmentQuery(item)} site:jiji.ng`),
        ];
      default:
        return [];
    }
  }

  private compactTerms(parts: Array<string | number | undefined | null>): string {
    return parts
      .map(part => String(part || '').trim())
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private dedupeSearchTerms(text: string): string {
    const seen = new Set<string>();
    return text
      .split(/\s+/)
      .filter((word) => {
        const key = word.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .join(' ')
      .trim();
  }

  private stripBulkNarrative(value?: string): string {
    if (!value) return '';
    const trimmed = value.trim();
    const cut = trimmed.search(/\s+(approximately|stored in|across photos|all bags|surrounding|consistent with)/i);
    const short = cut > 0 ? trimmed.slice(0, cut) : trimmed;
    return short.replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  private sanitizeQuery(query: string): string {
    return query
      .replace(/[<>\"']/g, '') // Remove HTML/JS injection chars
      .replace(/[;&|`$()]/g, '') // Remove shell injection chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 160); // Keep Serper queries short and product-focused
  }
}

// Export singleton instance
export const queryBuilder = new QueryBuilderService();
