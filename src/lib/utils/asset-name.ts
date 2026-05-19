export type AssetNameDetails = {
  make?: unknown;
  model?: unknown;
  year?: unknown;
  vin?: unknown;
  propertyType?: unknown;
  address?: unknown;
  brand?: unknown;
  serialNumber?: unknown;
  machineryType?: unknown;
  type?: unknown;
};

export function formatAssetName(
  assetType: string,
  assetDetails?: AssetNameDetails | null,
  fallback?: string | null
): string {
  const details = assetDetails || {};
  const candidates = [
    [details.year, details.make, details.model],
    [details.year, details.brand, details.model],
    [details.make, details.model],
    [details.brand, details.model],
    [details.brand, details.machineryType],
    [details.propertyType, details.address],
    [details.type, details.brand],
    [details.address],
    [fallback],
    [assetType.replace(/_/g, ' ')],
  ];

  for (const parts of candidates) {
    const label = parts
      .filter((part) => part !== undefined && part !== null && String(part).trim().length > 0)
      .map((part) => String(part).trim())
      .join(' ');

    if (label) return label;
  }

  return 'Salvage Item';
}
