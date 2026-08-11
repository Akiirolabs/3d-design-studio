import { ASSET_LIBRARY } from '../src/data/assetsLibrary';
import { getAssetCategory } from '../src/utils/assetCatalog';

export const AI_ASSET_TYPES = Object.freeze(ASSET_LIBRARY.map((asset) => asset.type));

export function normalizeGeneratedScene(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Generated scene must be an object.');
  const scene = value as Record<string, unknown>;
  if (!Array.isArray(scene.objects)) throw new Error('Generated scene objects must be an array.');
  return {
    ...scene,
    objects: scene.objects.map((candidate, index) => {
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
        throw new Error(`Generated object ${index + 1} must be an object.`);
      }
      const object = candidate as Record<string, unknown>;
      if (typeof object.type !== 'string') throw new Error(`Generated object ${index + 1} has no asset type.`);
      const category = getAssetCategory(object.type);
      if (!category) throw new Error(`Generated object ${index + 1} has unsupported asset type "${object.type}".`);
      return { ...object, category };
    }),
  };
}
