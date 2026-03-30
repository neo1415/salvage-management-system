/**
 * Query Builder Service for Universal Internet Search
 * 
 * This service constructs intelligent search queries for different item types
 * and search scenarios, optimized for Nigerian market conditions.
 */

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

export type ItemIdentifier = 
  | VehicleIdentifier 
  | ElectronicsIdentifier 
  | ApplianceIdentifier 
  | PropertyIdentifier
  | JewelryIdentifier
  | FurnitureIdentifier
  | MachineryIdentifier;

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
      default:
        throw new Error(`Unsupported item type: ${(item as any).type}`);
    }
    
    // Add condition terms - CRITICAL for accurate pricing
    if (includeCondition && item.condition) {
      const normalizedCondition = normalizeCondition(item.condition);
      if (normalizedCondition) {
        const conditionTerms = CONDITION_SEARCH_TERMS[normalizedCondition];
        if (conditionTerms && conditionTerms.length > 0) {
          // Use the primary condition term for better search accuracy
          query += ` ${conditionTerms[0]}`;
          console.log(`🔍 Including condition in search: "${conditionTerms[0]}" for ${normalizedCondition}`);
        }
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
    // Convert to PartIdentifier format
    // For non-vehicles, use brand instead of 'generic'
    const partIdentifier: PartIdentifier = {
      vehicleMake: item.type === 'vehicle' ? item.make : (item.type === 'electronics' || item.type === 'appliance' || item.type === 'watch' ? (item as any).brand : 'generic'),
      vehicleModel: item.type === 'vehicle' ? item.model : (item as any).model,
      vehicleYear: item.type === 'vehicle' ? item.year : undefined,
      partName,
      partType: this.mapDamageTypeToPartType(damageType),
      damageLevel: 'moderate' // Default damage level
    };
    
    return this.buildPartQuery(partIdentifier);
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
  buildConditionQuery(baseQuery: string, condition: UniversalCondition): string[] {
    const normalizedCondition = normalizeCondition(condition);
    if (!normalizedCondition) {
      // Return base query without condition if condition not supported
      return [this.sanitizeQuery(`${baseQuery} price Nigeria`)];
    }
    
    const conditionTerms = CONDITION_SEARCH_TERMS[normalizedCondition];
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
    if (item.condition && variations.length < maxVariations) {
      const conditionQueries = this.buildConditionQuery(
        this.getBaseItemQuery(item), 
        item.condition
      );
      variations.push(...conditionQueries.slice(0, maxVariations - variations.length));
    }
    
    // Marketplace-specific variation
    if (variations.length < maxVariations) {
      variations.push(this.buildMarketQuery(item, { includeMarketplace: true }));
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
    
    // Add condition terms for better accuracy
    if (machinery.condition) {
      const normalizedCondition = normalizeCondition(machinery.condition);
      if (normalizedCondition) {
        const conditionTerms = CONDITION_SEARCH_TERMS[normalizedCondition];
        if (conditionTerms && conditionTerms.length > 0) {
          query += ` ${conditionTerms[0]}`;
        }
      }
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
      default:
        return '';
    }
  }

  private sanitizeQuery(query: string): string {
    return query
      .replace(/[<>\"']/g, '') // Remove HTML/JS injection chars
      .replace(/[;&|`$()]/g, '') // Remove shell injection chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 500); // Limit length
  }
}

// Export singleton instance
export const queryBuilder = new QueryBuilderService();