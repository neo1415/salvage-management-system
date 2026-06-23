import type { AssetTypePolicy } from './types';

export type CaseAssetTypeOption = {
  value: string;
  label: string;
  icon: string;
};

/** Catalog shown on case creation — values must match case form Zod enum. */
export const CASE_ASSET_TYPE_CATALOG: CaseAssetTypeOption[] = [
  { value: 'vehicle', label: 'Vehicle', icon: 'Auto' },
  { value: 'goods_in_transit', label: 'Goods in Transit / Cargo', icon: 'GIT' },
  { value: 'stock', label: 'Warehouse Stock / Inventory', icon: 'Stock' },
  { value: 'building_materials', label: 'Building Materials', icon: 'Mat' },
  { value: 'property', label: 'Building / Fixtures', icon: 'Prop' },
  { value: 'machinery', label: 'Machinery & Equipment', icon: 'Plant' },
  { value: 'electronics', label: 'Electronics / ICT', icon: 'ICT' },
  { value: 'appliance', label: 'Appliance', icon: 'Appl' },
  { value: 'furniture', label: 'Furniture / Contents', icon: 'Furn' },
  { value: 'scrap', label: 'Scrap / Recoverable Parts', icon: 'Scrap' },
  { value: 'agriculture', label: 'Agricultural Stock / Equipment', icon: 'Agri' },
  { value: 'medical_equipment', label: 'Medical Equipment', icon: 'Med' },
  { value: 'energy_equipment', label: 'Energy / Oil & Gas Equipment', icon: 'Energy' },
  { value: 'aviation_equipment', label: 'Aviation / Special Risk Equipment', icon: 'Air' },
  { value: 'jewelry', label: 'Jewelry & Watches', icon: 'Gem' },
  { value: 'other', label: 'Other Salvage Asset', icon: 'Other' },
];

/**
 * Asset types available on case creation — only those enabled in business policy.
 */
export function getEnabledCaseAssetTypeOptions(
  enabledAssetTypes: Record<string, AssetTypePolicy> | undefined
): CaseAssetTypeOption[] {
  if (!enabledAssetTypes) {
    return CASE_ASSET_TYPE_CATALOG;
  }

  return CASE_ASSET_TYPE_CATALOG
    .filter((type) => enabledAssetTypes[type.value]?.enabled === true)
    .map((type) => ({
      ...type,
      label: enabledAssetTypes[type.value]?.label?.trim() || type.label,
    }));
}
