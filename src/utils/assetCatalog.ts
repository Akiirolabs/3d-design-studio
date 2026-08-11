import { AssetCategory, AssetTemplate } from '../types';
import { ASSET_LIBRARY } from '../data/assetsLibrary';

export const ASSET_TYPE_CATEGORIES: ReadonlyMap<string, AssetCategory> = new Map(
  ASSET_LIBRARY.map((asset) => [asset.type, asset.category])
);

/** Types emitted with `architecture` by the historical AI/project format. */
export const LEGACY_ARCHITECTURE_TYPES: ReadonlySet<string> = new Set([
  'cube', 'sphere', 'cylinder', 'cone', 'torus', 'plane',
  'wall', 'pillar', 'arch', 'stair', 'window', 'door',
  'sofa', 'chair', 'table', 'lamp',
  'plant', 'tree', 'rock',
  'spotlight', 'pointlight',
]);

export function getAssetCategory(type: string): AssetCategory | undefined {
  return ASSET_TYPE_CATEGORIES.get(type);
}

export function isKnownAssetType(type: string): boolean {
  return ASSET_TYPE_CATEGORIES.has(type);
}

export function isValidAssetTypeCategory(type: string, category: AssetCategory): boolean {
  return ASSET_TYPE_CATEGORIES.get(type) === category;
}

export function filterAssets(
  assets: readonly AssetTemplate[],
  category: AssetCategory | 'all',
  query: string
): AssetTemplate[] {
  const normalizedQuery = query.trim().toLowerCase();
  return assets.filter((asset) => {
    const categoryMatches = category === 'all' || asset.category === category;
    const searchable = [asset.name, asset.description, ...(asset.tags ?? [])].join(' ').toLowerCase();
    return categoryMatches && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
}
