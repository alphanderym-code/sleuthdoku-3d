# Tiny Crime Game — Improvement Brief

Murdoku-style logic puzzle. Read the existing code first, keep the current grid / one-per-row-and-column structure, then work through the items below. Suggest an order of work, implement in small steps, and test after each one.

## 1. Puzzle generation / content
- **Names:** more variety and more random picking (better mix of first names; avoid repeats and predictable sets).
- **Object clustering:** stoves and desks sometimes appear 4 together, which makes no sense. Limit duplicates of the same object type placed adjacent to each other.
- **Item descriptions and occupancy:** give each item a short description and define which items can or can't be occupied (as in the original Murdoku). Show this in the UI.

## 2. Object placement and orientation
- Objects must never face a wall (fireplace, stove, etc.).
- Orientation must make sense: chairs face the table, sofas face each other, and so on.

## 3. New mode: Extreme 16x16
- Add an extreme mode on a 16x16 grid (reference: https://murdoku.com/play/puzzle-the-golf-expert).
- Add a new environment/theme for it.

## 4. UI / controls
- **Erase button:** one click/tap erases a cell. It must be independent of the selected character.
- **Coordinates:** show row and column labels outside the board, chess-style (c2, b3, e6).

## 5. Graphics and animation
- Improve the overall graphics.
- Add more animations: objects, TV, stoves cooking, moving water, wind in the grass, etc.

## 6. New clue types / rules (explore, then propose before building)
The goal is a funnier and more challenging game while keeping the structure.
- **Weapon and wound clues:** for example "the victim was shot", so the killer holds a gun; other suspects "had a knife". Suspects carry weapons.
- Ideas to evaluate:
  - weapon-room link (knife in the kitchen, gun near the desk)
  - "the weapon is not in this room" (excludes a region)
  - one false clue (a liar suspect) the player must spot
  - alibi chains ("A was next to B, B never left the sofa")
  - silly personality clues ("Gary never sits near food", "Hugo always stands by a plant")
  - witness lines marking a zone ("I heard a scream from the kitchen")
  - line-of-sight and distance clues
  - difficulty tiers, where Extreme mixes all clue types
- Pick a few that fit the existing solver and puzzle generator. Verify each puzzle still has exactly one solution.
