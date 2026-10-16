# Changelog

## 1.8.1 — 2026-10-16

- Exports download directly when Spectre Lab runs as a page of its own, such as the website at sockmonke-rgb.github.io/Spectre-Lab. PDF export works there too; before, any view without the claude.ai save prompt showed the export as a picture instead, and a PDF came out as a PNG. Inside a frame, where browsers can block downloads, the picture is still shown.

## 1.8.0 — 2026-10-16

- Accessibility section in the panel, remembered in this browser:
  - Colour-blind safe colours for hexagon types, the four-colouring and rotation, based on the Okabe–Ito set and checked against simulated red-, green- and blue-blind vision, in light and dark themes. Tints and exports follow the chosen palette.
  - Patterns on tiles: each colour gets its own hatch, dots or grid, kept the same size on screen and drawn in black or white for contrast. The census legend shows the patterns too, and exports include them.
  - Bolder lines for grout, supertile outlines and the selection. On by default when the system asks for more contrast.
  - Text size 100%, 125% or 150% for the panel, studio bars and the labels drawn on the tiling.
- Keyboard: the tiling can be focused; arrow keys move the view, + and − zoom, 0 fits, Enter selects the tile in the middle. In the tile studio, arrow keys move the picture (Shift for bigger steps).
- Screen readers: selecting or walking to a tile announces its coordinates; the tiling has a description; switches are announced as switches; buttons in the selected-tile panel have full names; a "Skip to the controls" link; focus returns to where it was when the studio or the export preview closes.
- Larger touch targets on phones and tablets, slightly larger small text, and stronger borders when the system asks for more contrast.

## 1.7.0 — 2026-10-16

- Export background is now a choice: screen colour, white, or (PNG only) transparent. PDFs default to white.
- On a white background the tiling is drawn in the light colours, even when the app is in dark mode, so exports print cleanly.
- A single-tile PDF stays on the white page, so it has no background choice.

## 1.6.0 — 2026-10-16

- Export a single tile: your tile design on one Spectre.
  - PNG at 2,000 to 8,000 px across, transparent around the tile by default, with an optional outline in the grout colour.
  - PDF printed at actual size: choose the edge length (5 to 120 mm) and page. The outline is a vector line you can cut along, and a 50 mm bar lets you check the printer kept the size. The page says when the tile is too big for it.
  - With a separate design for the turned G halves, choose which design to export.
- The picture and drawing are painted afresh at the export size, so a large tile export stays sharp.

## 1.5.0 — 2026-10-16

- Tile studio: Mirror ↔ and Flip ↕ buttons for the picture. They work as seen on screen, about the picture's centre, even when it is turned, and each is one undo step. Fit picture keeps the mirroring; a new picture starts unmirrored.

## 1.4.0 — 2026-10-16

- The tile studio opens on Move picture instead of Brush.
- Two fingers turn the picture as well as resize it. Turning starts once the fingers have turned 10°, so a plain pinch does not tilt the picture, then catches up to follow the fingers exactly. It settles onto 0°, 45°, 90° and so on when close.
- − and + buttons beside every slider (brush size, picture scale and turn, picture width, tint): tap for one step, hold to repeat. Turn steps by 1°, scale by about 7%.
- The Turn slider shows the angle.

## 1.3.4 — 2026-10-16

- Tile studio: the frame stays put again (the view zoom from 1.3.3 is gone). Pinching with two fingers resizes the picture instead, damped so it grows more slowly than the fingers spread, around the point between the fingers. One pinch is one undo step.
- The Scale slider is logarithmic and shows the size as a percentage of the size that just covers the tile, from 25% to 800%. Scrolling in Move picture, or a trackpad pinch, resizes the picture too.
- A pinch still never draws, and Fill still acts when the finger lifts.

## 1.3.3 — 2026-10-16

- Tile studio: two fingers now zoom and pan the drawing view instead of the whole page. Zoom follows the fingers, with a small dead zone so resting two fingers does not jolt the view, and is limited to 0.6× to 8×.
- A pinch never draws, fills or moves the picture: a stroke started by the first finger is taken back when the second one lands, and Fill now acts when the finger lifts.
- Zoom buttons and Fit in the studio; ctrl+scroll or a trackpad pinch zooms on desktop.

## 1.3.2 — 2026-10-16

- New tile designs start blank. The arcs that used to be painted into every new design are now an "Edge loops" switch in the tile studio, off unless you turn it on.
- Adding a picture switches the edge loops off, and "Clear drawing" clears them too.
- Designs saved by earlier versions have the painted-in arcs lifted out on load, keeping your own drawing and pictures.

## 1.3.1 — 2026-10-16

- Choosing the "Turned G halves" tab in the tile studio no longer switches on a separate design by itself. The tab now shows which design the turned G halves use, and giving them their own design is a separate button. A new G-halves design starts as a copy of your main design.
- A separate G-halves design can be removed from the panel (the × on its thumbnail) or from the studio ("Use main design"). Removing it keeps the design, so it can be brought back.
- Thumbnails in the panel are labelled.
- On load, a G-halves design that the old tab switched on but that was never edited is switched off.

## 1.3.0 — 2026-10-16

- Version stamp (version, source hash, build time) under the title, in the console, in PDF captions and properties, and in PNG metadata.
- Packaged as a repository: build script, tests, MIT license.

## 1.2.0 — 2026-10-16

- Export the current view or the whole patch as a PNG (2,000 to 8,000 px, optional transparent background) or a one-page PDF (A4, A3 or Letter).

## 1.1.0 — 2026-10-16

- Tile studio: brush, eraser, fill, pictures, edge guides and a live preview.
- Tessellate a design turned with each tile, kept upright, or as one picture across the plane, with tint, grout and an optional design for the turned G halves.
- "Focus on this Spectre" and "Design this tile" from the selected tile.

## 1.0.0 — 2026-10-16

- Spectre tiling by nine-hexagon substitution with exact Z[d] coordinates, nested seeds and random ancestry.
- Colour by hexagon type, four-colouring, rotation or plain; supertile outlines, letters and curved edges.
- Tatham's combinatorial coordinates and edge walking for any tile.
