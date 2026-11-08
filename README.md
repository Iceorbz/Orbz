# Orbz Tower

A blocky, side-view tower-building sim where the tenants are little monsters (zombies, skeletons and friends). The current seasonal theme is **Harvest Haunt Tower** (Thanksgiving).

## Run it

```bash
npm install
npm run dev      # open the printed localhost URL
npm run build    # type-check and build to dist/
```

Controls: drag or WASD to pan, mouse wheel to zoom, G toggles the grid.

## Layout

- `src/config.ts`: grid and world size (cells, floors, ground line).
- `src/themes/`: seasonal themes. All room names, colors, food and decor live here, so a new holiday is one new file.
- `src/textures.ts`: procedural block art, so there are no image files to manage yet.
- `src/scenes/TowerScene.ts`: the tower world and camera.
- `src/scenes/UIScene.ts`: the HUD.

## Roadmap

1. Project setup, side-view tower and theme file (done)
2. Build and place rooms, stairs and an elevator
3. Monster patrons that move in, ride elevators and pay rent
4. Money, happiness, star rating and a Feast Day event

Desktop packaging (Electron or Tauri) comes after the prototype.
