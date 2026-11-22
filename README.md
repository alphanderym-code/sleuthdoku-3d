# Tiny Crimes

A cartoon 3D murder-mystery logic puzzle built with three.js. It is an original game in the grid-deduction genre.

## Play
From this folder:

```
python -m http.server 8765
```

Open http://localhost:8765 in your browser. There's no build step: three.js loads from a CDN, so you need an internet connection.

## Rules
- Place every character on the grid: **one per row and one per column**.
- Nobody stands on blocking objects (trees, tables…). Chairs, rugs, beds and the like are fine.
- Every clue is true. The **victim** was alone with the **murderer**: exactly 2 people are in the victim's room.

## Controls
- Click a suspect card to select them.
- **Tap** a cell to add a pencil note. **Drag** to paint notes.
- **Press & hold** a cell to place the suspect there. Hold the suspect's own cell again to remove them.
- Tools: X marks, Eraser (hold the button to clear everything), Undo (Ctrl+Z), Hint, Submit.
- Keyboard shortcuts: 1–9 selects a suspect, N / X / E switch tools, Esc deselects.
- Camera: right-drag (or two fingers) rotates, and the wheel (or pinch) zooms.

## Project layout
See `SPEC.md`. The parts are:
- model, solver, hints and generator: `js/model/`
- 3D: `js/render/`
- UI: `js/ui/`, `js/main.js`
- content: `js/data/`
- sounds: `js/audio/`
- cases: `js/puzzles/`

Tests are plain Node scripts, run as `node tests/<name>.test.mjs`. `node tools/make-cases.mjs` regenerates the hand-picked cases.
