import { AssetCategory, AssetTemplate } from '../types';

type CatalogSeed = readonly [id: string, name: string, description: string, tags: readonly string[], scale?: readonly [number, number, number]];

function templates(category: AssetCategory, seeds: readonly CatalogSeed[]): AssetTemplate[] {
  return seeds.map(([id, name, description, tags, scale = [1, 1, 1]]) => ({
    id,
    name,
    category,
    type: id,
    description,
    iconName: 'Box',
    defaultScale: [...scale],
    defaultColor: category === 'technology' ? '#334155' : category === 'stationery' ? '#d6b98c' : '#8b5cf6',
    defaultMaterial: category === 'technology' ? 'anodized_black' : 'matte_white',
    tags: [...tags],
  }));
}

export const EXPANDED_ASSET_LIBRARY: AssetTemplate[] = [
  ...templates('primitives', [
    ['parametric-extrusion', 'Parametric Extrusion', 'Editable tapered and twisted extrusion with a closed profile.', ['shape', 'extrude', 'twist', 'taper']],
    ['rounded-box', 'Rounded Box', 'Soft-edged box for printable enclosures.', ['shape', 'rounded', 'box']],
    ['pyramid', 'Square Pyramid', 'Four-sided pyramid primitive.', ['shape', 'pyramid']],
    ['tetrahedron', 'Tetrahedron', 'Four-face regular solid.', ['shape', 'polyhedron']],
    ['octahedron', 'Octahedron', 'Eight-face regular solid.', ['shape', 'polyhedron']],
    ['dodecahedron', 'Dodecahedron', 'Twelve-face regular solid.', ['shape', 'polyhedron']],
    ['icosahedron', 'Icosahedron', 'Twenty-face regular solid.', ['shape', 'polyhedron']],
    ['ring', 'Flat Ring', 'Flat annular ring or printable washer.', ['shape', 'ring', 'washer']],
    ['tube', 'Hollow Tube', 'Open-ended cylindrical tube.', ['shape', 'tube', 'pipe']],
    ['wedge', 'Wedge', 'Triangular wedge for supports and ramps.', ['shape', 'wedge', 'ramp']],
    ['hemisphere', 'Hemisphere', 'Half-sphere dome primitive.', ['shape', 'dome']],
    ['star', 'Five-Point Star', 'Extruded decorative star.', ['shape', 'star']],
    ['hex-prism', 'Hexagonal Prism', 'Six-sided mechanical prism.', ['shape', 'hex', 'prism']],
    ['cross', 'Cross Block', 'Orthogonal cross-shaped solid.', ['shape', 'cross']],
  ]),
  ...templates('technology', [
    ['rpi4-pcb', 'Raspberry Pi 4 PCB', 'Nominal 85 x 56 mm Raspberry Pi 4 Model B reference-fit board with port blocks.', ['raspberry pi', 'rpi4', 'pcb', '85mm', '56mm'], [0.85, 0.08, 0.56]],
    ['rpi4-case-base', 'Pi 4 Case Base', 'Nominal Raspberry Pi 4 Model B reference-fit vented base.', ['raspberry pi', 'rpi4', 'case', 'base'], [0.92, 0.24, 0.64]],
    ['rpi4-case-top', 'Pi 4 Case Top', 'Nominal Raspberry Pi 4 Model B reference-fit top shell.', ['raspberry pi', 'rpi4', 'case', 'top'], [0.92, 0.12, 0.64]],
    ['rpi4-port-case', 'Pi 4 Port-Gap Case', 'Segmented nominal Pi 4 enclosure with USB, Ethernet, HDMI and power access gaps.', ['raspberry pi', 'rpi4', 'ports', 'case'], [0.92, 0.28, 0.64]],
    ['cyberdeck-frame', 'Cyberdeck Frame', 'Rugged modular keyboard and screen carrier frame.', ['cyberdeck', 'frame', 'computer'], [2.4, 0.2, 1.5]],
    ['cyberdeck-handle', 'Cyberdeck Handle', 'Printable reinforced carry handle.', ['cyberdeck', 'handle']],
    ['screen-5', '5-inch Screen', 'Nominal 16:9 display reference panel.', ['screen', 'display', '5 inch'], [1.11, 0.62, 0.06]],
    ['screen-frame-5', '5-inch Screen Frame', 'Matched bezel for the nominal 5-inch screen.', ['screen', 'frame', '5 inch'], [1.22, 0.73, 0.08]],
    ['screen-back-5', '5-inch Back Cover', 'Matched shallow rear cover for the nominal 5-inch frame.', ['screen', 'cover', '5 inch'], [1.22, 0.73, 0.18]],
    ['screen-7', '7-inch Screen', 'Nominal 16:10 display reference panel.', ['screen', 'display', '7 inch'], [1.54, 0.96, 0.06]],
    ['screen-frame-7', '7-inch Screen Frame', 'Matched bezel for the nominal 7-inch screen.', ['screen', 'frame', '7 inch'], [1.68, 1.1, 0.08]],
    ['screen-back-7', '7-inch Back Cover', 'Matched shallow rear cover for the nominal 7-inch frame.', ['screen', 'cover', '7 inch'], [1.68, 1.1, 0.2]],
    ['screen-10', '10-inch Screen', 'Nominal 16:10 display reference panel.', ['screen', 'display', '10 inch'], [2.16, 1.35, 0.07]],
    ['screen-frame-10', '10-inch Screen Frame', 'Matched bezel for the nominal 10-inch screen.', ['screen', 'frame', '10 inch'], [2.32, 1.51, 0.09]],
    ['screen-back-10', '10-inch Back Cover', 'Matched rear cover for the nominal 10-inch frame.', ['screen', 'cover', '10 inch'], [2.32, 1.51, 0.22]],
    ['keyboard-tray', 'Compact Keyboard Tray', 'Angled tray for a compact cyberdeck keyboard.', ['keyboard', 'tray', 'cyberdeck'], [2.2, 0.12, 0.85]],
  ]),
  ...templates('stationery', [
    ['pen-cup', 'Pen Cup', 'Printable desktop pen and pencil cup.', ['office', 'pen', 'organizer']],
    ['pencil-tray', 'Pencil Tray', 'Low-profile desk tray for writing tools.', ['office', 'pencil', 'tray'], [1.8, 0.2, 0.7]],
    ['desk-organizer', 'Desk Organizer', 'Multi-compartment home-office organizer.', ['office', 'organizer'], [1.8, 0.5, 1.1]],
    ['phone-stand', 'Phone Stand', 'Angled printable phone display stand.', ['office', 'phone', 'stand']],
    ['tablet-stand', 'Tablet Stand', 'Wide slotted tablet support.', ['office', 'tablet', 'stand'], [1.4, 1.1, 1.2]],
    ['business-card-holder', 'Business Card Holder', 'Compact slotted card holder.', ['office', 'card', 'holder']],
    ['paper-tray', 'Paper Tray', 'Stackable letter-paper inbox tray.', ['office', 'paper', 'tray'], [2.2, 0.25, 1.6]],
    ['bookend', 'Bookend', 'L-shaped shelf and desk bookend.', ['office', 'book', 'support']],
    ['cable-clip', 'Cable Clip', 'Small open cable-routing clip.', ['office', 'cable', 'clip']],
    ['headphone-stand', 'Headphone Stand', 'Desktop arch for over-ear headphones.', ['office', 'headphone', 'stand'], [1.2, 2, 1]],
    ['sticky-note-holder', 'Sticky Note Holder', 'Square holder for standard note pads.', ['office', 'notes', 'holder']],
    ['monitor-riser', 'Monitor Riser', 'Simple printable monitor shelf with feet.', ['office', 'monitor', 'riser'], [2.5, 0.45, 1.2]],
  ]),
  ...templates('creative', [
    ['gear', 'Spur Gear', 'Stylized low-segment mechanical gear.', ['mechanical', 'gear']],
    ['vase', 'Twist Vase', 'Faceted decorative printable vase.', ['decor', 'vase']],
    ['planter', 'Geometric Planter', 'Faceted desktop planter shell.', ['decor', 'planter']],
    ['wall-hook', 'Wall Hook', 'Rounded utility hook with mounting plate.', ['utility', 'hook']],
    ['key-tag', 'Key Tag', 'Rounded tag with hanging hole.', ['tag', 'keychain']],
    ['dice', 'Blank Dice', 'Rounded blank cube for game projects.', ['game', 'dice']],
    ['mini-crate', 'Mini Crate', 'Slatted storage and display crate.', ['storage', 'crate']],
    ['display-plinth', 'Display Plinth', 'Tiered base for models and collectibles.', ['display', 'stand', 'plinth']],
  ]),
];
