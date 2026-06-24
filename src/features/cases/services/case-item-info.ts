import type { UniversalItemInfo } from '@/features/cases/services/ai-assessment-enhanced.service';

type AssetDetails = Record<string, unknown>;

export function buildUniversalItemInfoFromCase(input: {
  assetType: string;
  assetDetails: unknown;
  marketValue?: string | number | null;
}): UniversalItemInfo | undefined {
  const details = (input.assetDetails && typeof input.assetDetails === 'object'
    ? input.assetDetails
    : {}) as AssetDetails;

  const marketValue = Number(input.marketValue);
  const conditionRaw = typeof details.condition === 'string' ? details.condition : 'Nigerian Used';
  const condition = (
    ['Brand New', 'Nigerian Used', 'Foreign Used (Tokunbo)', 'Heavily Used'].includes(conditionRaw)
      ? conditionRaw
      : 'Nigerian Used'
  ) as UniversalItemInfo['condition'];

  const base: UniversalItemInfo = {
    type: input.assetType as UniversalItemInfo['type'],
    condition,
    marketValue: Number.isFinite(marketValue) && marketValue > 0 ? marketValue : undefined,
  };

  switch (input.assetType) {
    case 'vehicle':
      return {
        ...base,
        type: 'vehicle',
        make: String(details.make || ''),
        model: String(details.model || ''),
        year: typeof details.year === 'number' ? details.year : Number(details.year) || undefined,
        mileage: typeof details.mileage === 'number' ? details.mileage : Number(details.mileage) || undefined,
      };
    case 'property':
      return {
        ...base,
        type: 'property',
        propertyType: String(details.propertyType || details.description || ''),
        location: String(details.location || details.locationName || ''),
      };
    case 'electronics':
      return {
        ...base,
        type: 'electronics',
        brand: String(details.brand || ''),
        model: String(details.model || ''),
        storageCapacity: typeof details.storage === 'string' ? details.storage : undefined,
      };
    case 'appliance':
      return {
        ...base,
        type: 'appliance',
        brand: String(details.brand || ''),
        model: String(details.model || ''),
      };
    case 'jewelry':
      return {
        ...base,
        type: 'jewelry',
        brand: typeof details.brand === 'string' ? details.brand : undefined,
        model: String(details.type || details.material || details.description || ''),
        material: typeof details.material === 'string' ? details.material : undefined,
        quantity: typeof details.weight === 'string' ? details.weight : undefined,
      };
    case 'furniture':
      return {
        ...base,
        type: 'furniture',
        brand: typeof details.brand === 'string' ? details.brand : undefined,
        model: String(details.type || details.description || ''),
        material: typeof details.material === 'string' ? details.material : undefined,
      };
    case 'machinery':
      return {
        ...base,
        type: 'machinery',
        brand: String(details.brand || ''),
        machineryType: String(details.type || details.machineryType || ''),
        model: typeof details.model === 'string' ? details.model : undefined,
        year: typeof details.year === 'number' ? details.year : Number(details.year) || undefined,
      };
    case 'stock':
    case 'goods_in_transit':
    case 'building_materials':
    case 'scrap':
    case 'agriculture':
      return {
        ...base,
        type: input.assetType as UniversalItemInfo['type'],
        brand: typeof details.brand === 'string' ? details.brand : undefined,
        description: String(details.description || ''),
        model: typeof details.packagingType === 'string' ? details.packagingType : undefined,
        quantity: typeof details.quantity === 'string' ? details.quantity : String(details.quantity || ''),
        unitOfMeasure: typeof details.unitOfMeasure === 'string' ? details.unitOfMeasure : undefined,
        packagingType: typeof details.packagingType === 'string' ? details.packagingType : undefined,
      };
    case 'medical_equipment':
    case 'energy_equipment':
    case 'aviation_equipment':
    case 'other':
      return {
        ...base,
        type: input.assetType as UniversalItemInfo['type'],
        brand: typeof details.brand === 'string' ? details.brand : undefined,
        description: String(details.description || ''),
        quantity: typeof details.quantity === 'string' ? details.quantity : String(details.quantity || ''),
        unitOfMeasure: typeof details.unitOfMeasure === 'string' ? details.unitOfMeasure : undefined,
      };
    default:
      return undefined;
  }
}
