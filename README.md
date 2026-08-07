# 3D Design Studio

3D Design Studio is a browser-based scene editor for building and arranging procedural 3D environments. It combines a React interface with a Three.js viewport and includes object transforms, materials, environment controls, exports, local project persistence, and optional AI-assisted scene generation through Google Gemini.

## Features

- Add architectural, interior, landscape, lighting, and primitive assets
- Select, move, rotate, scale, duplicate, hide, lock, and delete objects
- Edit colors and physically based material properties
- Switch viewport rendering and environment settings
- Use grid snapping, undo, redo, and keyboard shortcuts
- Export projects and 3D geometry
- Save project state in browser local storage
- Generate scene layouts with Gemini when an API key is configured

## Tech stack

- React 19 and TypeScript
- Three.js
- Vite
- Express
- Tailwind CSS
- Vitest
- Google Gen AI SDK

## Requirements

- Node.js 20 or newer
- npm
- A modern browser with WebGL support
- A Gemini API key only if you want to use AI scene generation

## Run locally

1. Clone the repository and enter the project directory:

   ```powershell
   git clone git@github.com:YOUR_USERNAME/YOUR_REPOSITORY.git
   cd YOUR_REPOSITORY
   ```

2. Install dependencies:

   ```powershell
   npm install
   ```

3. Optional: set a Gemini API key for the current PowerShell session:

   ```powershell
   $env:GEMINI_API_KEY="YOUR_GEMINI_API_KEY"
   ```

4. Start the development server:

   ```powershell
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

The editor works without a Gemini API key, but AI scene generation will be unavailable.

> If PowerShell blocks `npm.ps1`, use `npm.cmd install` and `npm.cmd run dev` instead.

## Available commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Express and Vite development server |
| `npm test` | Run the Vitest test suite once |
| `npm run lint` | Run the TypeScript compiler without emitting files |
| `npm run build` | Build the frontend and production server |
| `npm start` | Start the previously built production server |
| `npm run clean` | Remove generated build output |

## Production build

```powershell
npm run build
$env:NODE_ENV="production"
npm start
```

The production server runs at [http://localhost:3000](http://localhost:3000).

## Basic workflow

1. Add an asset from the left sidebar.
2. Select the asset in the viewport or hierarchy.
3. Move, rotate, or scale it with the transform gizmo.
4. Adjust its appearance in the inspector.
5. Configure the grid, lighting, and environment.
6. Export or capture the finished scene.

Projects are stored in the current browser's local storage. Clearing site data can remove locally saved project state, so export important work as a backup.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | No | Enables Gemini-powered scene generation |
| `NODE_ENV` | No | Set to `production` when running the production build |
| `DISABLE_HMR` | No | Set to `true` to disable Vite hot-module reloading |

Do not commit API keys or other secrets to Git.
