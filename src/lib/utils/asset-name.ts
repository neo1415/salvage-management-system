export type AssetNameDetails = {
  make?: unknown;
  model?: unknown;
  year?: unknown;
  vin?: unknown;
  propertyType?: unknown;
  address?: unknown;
  brand?: unknown;
  stockBrand?: unknown;
  storage?: unknown;
  storageCapacity?: unknown;
  color?: unknown;
  serialNumber?: unknown;
  machineryType?: unknown;
  type?: unknown;
  furnitureType?: unknown;
  itemName?: unknown;
  itemDescription?: unknown;
  description?: unknown;
  assetDescription?: unknown;
  stockType?: unknown;
  jewelryType?: unknown;
  applianceType?: unknown;
  buildingMaterialType?: unknown;
  quantity?: unknown;
  unitOfMeasure?: unknown;
  packagingType?: unknown;
  batchOrSerial?: unknown;
  consignmentReference?: unknown;
  material?: unknown;
  damageArea?: unknown;
  locationName?: unknown;
  manufacturer?: unknown;
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  vehicle: 'Vehicle',
  property: 'Property',
  electronics: 'Electronics',
  appliance: 'Appliance',
  jewelry: 'Jewelry',
  furniture: 'Furniture',
  machinery: 'Machinery',
  stock: 'Stock goods',
  goods_in_transit: 'Cargo in transit',
  building_materials: 'Building materials',
  scrap: 'Scrap metal',
  agriculture: 'Agricultural produce',
  medical_equipment: 'Medical equipment',
  energy_equipment: 'Energy equipment',
  aviation_equipment: 'Aviation equipment',
  other: 'Salvage asset',
};

const BULK_ASSET_TYPES = new Set([
  'stock',
  'goods_in_transit',
  'building_materials',
  'scrap',
  'agriculture',
]);

function stringOrEmpty(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function joinParts(parts: unknown[]): string | null {
  const label = parts
    .map(stringOrEmpty)
    .filter((part) => part.length > 0)
    .join(' ');

  return label.length > 0 ? label : null;
}

function quantityLabel(details: AssetNameDetails): string | null {
  const qty = stringOrEmpty(details.quantity);
  if (!qty) return null;
  const unit = stringOrEmpty(details.unitOfMeasure);
  return unit ? `${qty} ${unit}` : qty;
}

function assetTypeLabel(assetType: string): string {
  return ASSET_TYPE_LABELS[assetType] || assetType.replace(/_/g, ' ');
}

function formatByAssetType(assetType: string, details: AssetNameDetails): string | null {
  const brand = stringOrEmpty(details.brand) || stringOrEmpty(details.stockBrand);
  const description =
    stringOrEmpty(details.description) ||
    stringOrEmpty(details.itemDescription) ||
    stringOrEmpty(details.assetDescription);
  const qty = quantityLabel(details);

  switch (assetType) {
    case 'vehicle':
      return (
        joinParts([details.year, details.make, details.model]) ||
        joinParts([details.make, details.model]) ||
        joinParts([details.vin])
      );
    case 'property':
      return (
        joinParts([details.propertyType, details.damageArea]) ||
        joinParts([details.propertyType, details.address]) ||
        joinParts([description])
      );
    case 'electronics':
      return (
        joinParts([details.brand, details.model, details.storage || details.storageCapacity]) ||
        joinParts([details.brand, details.model]) ||
        joinParts([description])
      );
    case 'appliance':
      return (
        joinParts([details.applianceType, details.brand, details.model]) ||
        joinParts([details.brand, details.model]) ||
        joinParts([description])
      );
    case 'jewelry':
      return (
        joinParts([details.jewelryType, details.brand, details.material]) ||
        joinParts([description])
      );
    case 'furniture':
      return (
        joinParts([details.furnitureType, details.brand, details.material]) ||
        joinParts([details.itemName, details.brand]) ||
        joinParts([description])
      );
    case 'machinery':
      return (
        joinParts([details.brand, details.machineryType, details.model]) ||
        joinParts([details.manufacturer, details.model, details.year]) ||
        joinParts([details.machineryType, details.model]) ||
        joinParts([description])
      );
    case 'stock':
    case 'scrap':
    case 'building_materials':
    case 'agriculture':
      return (
        joinParts([description]) ||
        joinParts([brand, details.packagingType]) ||
        joinParts([details.buildingMaterialType, brand]) ||
        joinParts([details.stockType, brand]) ||
        joinParts([qty, description]) ||
        joinParts([qty]) ||
        joinParts([details.batchOrSerial]) ||
        joinParts([brand])
      );
    case 'goods_in_transit':
      return (
        joinParts([description]) ||
        joinParts([details.consignmentReference, description]) ||
        joinParts([brand, details.packagingType]) ||
        joinParts([qty, description]) ||
        joinParts([qty]) ||
        joinParts([details.batchOrSerial])
      );
    case 'medical_equipment':
    case 'energy_equipment':
    case 'aviation_equipment':
    case 'other':
      return (
        joinParts([description, brand]) ||
        joinParts([brand, details.model]) ||
        joinParts([description]) ||
        joinParts([details.itemName, details.serialNumber])
      );
    default:
      if (BULK_ASSET_TYPES.has(assetType)) {
        return (
          joinParts([description]) ||
          joinParts([brand, details.packagingType]) ||
          joinParts([qty])
        );
      }
      return (
        joinParts([details.itemName, details.brand, details.model]) ||
        joinParts([description]) ||
        joinParts([details.type, brand])
      );
  }
}

export function formatAssetName(
  assetType: string,
  assetDetails?: AssetNameDetails | null,
  fallback?: string | null
): string {
  const details = assetDetails || {};
  const typedLabel = formatByAssetType(assetType, details);

  if (typedLabel) {
    return typedLabel;
  }

  const generic =
    joinParts([details.itemDescription, details.description, details.assetDescription]) ||
    joinParts([details.itemName, details.brand, details.model]) ||
    stringOrEmpty(fallback) ||
    assetTypeLabel(assetType);

  return generic || 'Auction item';
}
