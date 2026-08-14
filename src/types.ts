export type TransformMode = 'translate' | 'rotate' | 'scale';

export type ViewportRenderMode = 'shaded' | 'wireframe' | 'photoreal' | 'normals';

export type EnvironmentTheme = 'studio' | 'sunset' | 'midnight' | 'daylight' | 'warm';

export interface ParametricExtrusionGeometry {
  kind: 'parametric-extrusion';
  profile: [number, number][];
  height: number;
  baseScale: number;
  topScale: number;
  twistAngle: number;
  twistSteps: number;
  twistMode: 'steps' | 'smooth';
}

export interface FaceExtrusionModifier {
  kind:'face-extrusion';
  sourceFingerprint:string;
  face:{centroid:[number,number,number];normal:[number,number,number];basisU:[number,number,number];basisV:[number,number,number];profile:[number,number][];attachmentLoop:[number,number,number][];signature:string;sourceFingerprint:string;triangleIndices:number[];boundaryNeighborDotMax:number;meshPath?:number[]};
  distance:number;baseScale:1;topScale:number;twistAngle:number;twistSteps:number;twistMode:'steps'|'smooth';
}

export type AssetCategory =
  | 'primitives'
  | 'architecture'
  | 'interior'
  | 'environment'
  | 'lights'
  | 'technology'
  | 'stationery'
  | 'creative';

export interface SceneObject {
  id: string;
  name: string;
  type: string; // e.g., 'cube', 'wall', 'sofa', 'spotlight', etc.
  category: AssetCategory;
  position: [number, number, number];
  rotation: [number, number, number]; // in degrees
  scale: [number, number, number];
  color: string;
  materialPreset: string;
  metalness: number;
  roughness: number;
  transmission: number; // for glass/transparent materials
  clearcoat?: number;
  emission?: string;
  intensity?: number; // for lights
  visible: boolean;
  locked: boolean;
  geometry?: ParametricExtrusionGeometry;
  faceExtrusion?:FaceExtrusionModifier;
  /** A non-destructive Boolean subtraction. The referenced cutter remains in the project. */
  boolean?: { kind: 'subtract'; cutterId: string };
  holeForId?: string;
}

export interface ObjectGroup {
  id:string;
  name:string;
  memberIds:string[];
  pivot:[number,number,number];
  visible:boolean;
  locked:boolean;
}

export interface MaterialPreset {
  id: string;
  name: string;
  color: string;
  metalness: number;
  roughness: number;
  transmission: number;
  clearcoat?: number;
  emission?: string;
  category: 'Metals' | 'Glass & Water' | 'Wood & Organic' | 'Stone & Concrete' | 'Polymers & Fabrics' | 'Emissive';
}

export interface EnvironmentSettings {
  theme: EnvironmentTheme;
  sunElevation: number; // -90 to 90
  sunAzimuth: number; // 0 to 360
  intensity: number;
  shadows: boolean;
  shadowQuality: 'low' | 'medium' | 'high' | 'ultra';
  gridVisible: boolean;
  gridSnap: boolean;
  gridStep: number;
  fogDensity: number;
  bloom: boolean;
  bloomIntensity: number;
  ao: boolean; // Ambient Occlusion
  backgroundColor: string;
}

export interface AssetTemplate {
  id: string;
  name: string;
  category: AssetCategory;
  type: string;
  description: string;
  iconName: string;
  defaultScale: [number, number, number];
  defaultColor: string;
  defaultMaterial: string;
  previewSvg?: string;
  tags?: string[];
}

export interface CloudSession {
  roomCode:string;projectName:string;updatedAt:string;
  collaborators:{id:string;name:string;avatarColor:string;active:boolean;activeObjectId?:string}[];
  history:{id:string;timestamp:string;description:string}[];
}

export interface ProjectData {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  objects: SceneObject[];
  groups?: ObjectGroup[];
  environment: EnvironmentSettings;
  thumbnailUrl?: string;
}
