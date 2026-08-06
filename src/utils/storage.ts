import { ProjectData, SceneObject, EnvironmentSettings, CloudSession } from '../types';

const STORAGE_KEY = 'aether3d_studio_current_project';
const SAVED_PROJECTS_KEY = 'aether3d_studio_saved_projects';

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  theme: 'studio',
  sunElevation: 45,
  sunAzimuth: 135,
  intensity: 1.2,
  shadows: true,
  shadowQuality: 'high',
  gridVisible: true,
  gridSnap: true,
  gridStep: 1,
  fogDensity: 0.005,
  bloom: true,
  bloomIntensity: 0.4,
  ao: true,
  backgroundColor: '#0f172a',
};

// High-fidelity starting default scene: A modern architectural pavilion with furniture & lighting
export const DEFAULT_PROJECT_OBJECTS: SceneObject[] = [
  // Floor plate
  {
    id: 'obj_floor',
    name: 'Architectural Floor',
    category: 'architecture',
    type: 'plane',
    position: [0, -0.05, 0],
    rotation: [0, 0, 0],
    scale: [12, 0.1, 10],
    color: '#1e293b',
    materialPreset: 'charcoal_bamboo',
    metalness: 0.05,
    roughness: 0.4,
    transmission: 0,
    visible: true,
    locked: true,
  },
  // Back Concrete Wall
  {
    id: 'obj_wall_back',
    name: 'Feature Wall',
    category: 'architecture',
    type: 'wall',
    position: [0, 1.5, -4.9],
    rotation: [0, 0, 0],
    scale: [12, 3, 0.2],
    color: '#64748b',
    materialPreset: 'concrete',
    metalness: 0.05,
    roughness: 0.65,
    transmission: 0,
    visible: true,
    locked: false,
  },
  // Left Glass Curtain Wall
  {
    id: 'obj_wall_glass',
    name: 'Glass Facade',
    category: 'architecture',
    type: 'window',
    position: [-5.9, 1.75, 0],
    rotation: [0, 90, 0],
    scale: [9.8, 3.5, 0.1],
    color: '#38414e',
    materialPreset: 'crystal_clear',
    metalness: 0,
    roughness: 0.02,
    transmission: 0.9,
    visible: true,
    locked: false,
  },
  // Marble Pillar
  {
    id: 'obj_pillar_1',
    name: 'Carrara Column',
    category: 'architecture',
    type: 'pillar',
    position: [5.5, 1.75, -4.5],
    rotation: [0, 0, 0],
    scale: [0.6, 3.5, 0.6],
    color: '#f8fafc',
    materialPreset: 'marble',
    metalness: 0.02,
    roughness: 0.15,
    transmission: 0.05,
    visible: true,
    locked: false,
  },
  // Lounge Sofa
  {
    id: 'obj_sofa',
    name: 'Designer Lounge Sofa',
    category: 'interior',
    type: 'sofa',
    position: [-1.2, 0.4, -2],
    rotation: [0, 15, 0],
    scale: [2.6, 0.8, 1.1],
    color: '#1e3a8a',
    materialPreset: 'velvet_navy',
    metalness: 0,
    roughness: 0.9,
    transmission: 0,
    visible: true,
    locked: false,
  },
  // Marble Coffee Table
  {
    id: 'obj_table',
    name: 'Marble Coffee Table',
    category: 'interior',
    type: 'table',
    position: [-1.0, 0.22, -0.6],
    rotation: [0, 0, 0],
    scale: [1.4, 0.45, 1.4],
    color: '#f8fafc',
    materialPreset: 'marble',
    metalness: 0.02,
    roughness: 0.15,
    transmission: 0.05,
    visible: true,
    locked: false,
  },
  // Brass Floor Lamp
  {
    id: 'obj_lamp',
    name: 'Gold Floor Lamp',
    category: 'interior',
    type: 'lamp',
    position: [-2.9, 1.1, -2.8],
    rotation: [0, 45, 0],
    scale: [0.5, 2.2, 0.8],
    color: '#e5b94c',
    materialPreset: 'gold',
    metalness: 1.0,
    roughness: 0.15,
    transmission: 0,
    visible: true,
    locked: false,
  },
  // Potted Monstera Plant
  {
    id: 'obj_plant',
    name: 'Potted Monstera',
    category: 'environment',
    type: 'plant',
    position: [4.2, 0.7, -4.0],
    rotation: [0, 30, 0],
    scale: [0.9, 1.5, 0.9],
    color: '#15803d',
    materialPreset: 'matte_white',
    metalness: 0,
    roughness: 0.3,
    transmission: 0,
    visible: true,
    locked: false,
  },
  // Sculptural Torus Ring
  {
    id: 'obj_art_sculpture',
    name: 'Cyber Ring Sculpture',
    category: 'primitives',
    type: 'torus',
    position: [2.5, 1.2, -2.2],
    rotation: [30, 45, 0],
    scale: [1.2, 0.4, 1.2],
    color: '#06b6d4',
    materialPreset: 'neon',
    metalness: 0,
    roughness: 0.1,
    transmission: 0,
    emission: '#06b6d4',
    visible: true,
    locked: false,
  },
];

export function getInitialProject(): ProjectData {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      console.error('Failed to parse saved project:', e);
    }
  }

  return {
    id: 'proj_demo_architectural',
    name: 'Modern Pavilion Architectural Suite',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    objects: DEFAULT_PROJECT_OBJECTS,
    environment: DEFAULT_ENVIRONMENT,
  };
}

export function saveProjectToStorage(project: ProjectData) {
  try {
    const updated = { ...project, updatedAt: new Date().toISOString() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    
    // Save to list of saved projects
    const allSavedRaw = localStorage.getItem(SAVED_PROJECTS_KEY);
    let allSaved: ProjectData[] = allSavedRaw ? JSON.parse(allSavedRaw) : [];
    const index = allSaved.findIndex((p) => p.id === updated.id);
    if (index >= 0) {
      allSaved[index] = updated;
    } else {
      allSaved.push(updated);
    }
    localStorage.setItem(SAVED_PROJECTS_KEY, JSON.stringify(allSaved));
  } catch (e) {
    console.error('Error saving project to local storage:', e);
  }
}

export function loadSavedProjects(): ProjectData[] {
  try {
    const raw = localStorage.getItem(SAVED_PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [getInitialProject()];
  } catch (e) {
    return [getInitialProject()];
  }
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getInitialCloudSession(roomCode: string, projectName: string): CloudSession {
  return {
    roomCode,
    projectName,
    updatedAt: new Date().toISOString(),
    collaborators: [
      { id: 'usr_me', name: 'You (Lead Architect)', avatarColor: '#3b82f6', active: true },
      { id: 'usr_2', name: 'Sarah (Lighting Designer)', avatarColor: '#10b981', active: true },
      { id: 'usr_3', name: 'Alex (3D Sculptor)', avatarColor: '#f59e0b', active: false },
    ],
    history: [
      { id: 'h1', timestamp: 'Just now', description: 'Real-time Cloud Sync session established' },
      { id: 'h2', timestamp: '2 mins ago', description: 'Updated PBR material parameters on Carrara Column' },
      { id: 'h3', timestamp: '5 mins ago', description: 'AI Copilot generated Modern Pavilion base layout' },
    ],
  };
}
