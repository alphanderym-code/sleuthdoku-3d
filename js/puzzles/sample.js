import { assignFacing } from '../model/facing.js';

// Dev sample puzzle (5x5), following the genre conventions: suspects A-D, victim V, one clue each.
// Intended solution: A(0,1) V(1,3) C(2,0) B(3,4) D(4,2). Victim V in Cold Storage with murderer B.
export const SAMPLE_PUZZLE = {
  id: 'midnight-bakery',
  title: 'The Midnight Bakery',
  difficulty: 'very-easy',
  size: 5,
  outdoor: false,
  rooms: [
    'KKKSS',
    'KKKSS',
    'KOOOS',
    'FFOOS',
    'FFOOO',
  ],
  roomInfo: {
    K: { name: 'Kitchen', floor: 'tile' },
    S: { name: 'Cold Storage', floor: 'wood' },
    O: { name: 'Shop Floor', floor: 'checker' },
    F: { name: 'Office', floor: 'carpet' },
  },
  objects: [
    { type: 'oven', r: 0, c: 0 },
    { type: 'table', r: 1, c: 1 },
    { type: 'crate', r: 0, c: 4 },
    { type: 'chair', r: 3, c: 0 },
    { type: 'desk', r: 4, c: 0 },
    { type: 'rug', r: 3, c: 3 },
    { type: 'plant', r: 4, c: 4 },
    { type: 'counter', r: 2, c: 2 },
  ],
  notes: [{ type: 'countOnObject', object: 'chair', count: 0 }],
  characters: [
    { id: 'A', name: 'Ada', gender: 'f', victim: false,
      look: { skin: '#f1c27d', hair: '#3b2a1a', outfit: '#4f86c6', hairStyle: 'bun', accessory: 'glasses' },
      clues: [{ type: 'besideObject', object: 'oven' }] },
    { id: 'B', name: 'Bruno', gender: 'm', victim: false,
      look: { skin: '#c68642', hair: '#1b1b1b', outfit: '#d9534f', hairStyle: 'short', accessory: 'beard' },
      clues: [{ type: 'column', index: 4 }] },
    { id: 'C', name: 'Clara', gender: 'f', victim: false,
      look: { skin: '#ffdbac', hair: '#e0a040', outfit: '#6abf69', hairStyle: 'long', accessory: null },
      clues: [{ type: 'column', index: 0 }] },
    { id: 'D', name: 'Dimitri', gender: 'm', victim: false,
      look: { skin: '#8d5524', hair: '#2a1a10', outfit: '#9b6bd1', hairStyle: 'curly', accessory: 'hat' },
      clues: [{ type: 'aloneInRoom', room: 'O' }] },
    { id: 'V', name: 'Victor', gender: 'm', victim: true,
      look: { skin: '#e0ac69', hair: '#7a7a7a', outfit: '#f0c419', hairStyle: 'bald', accessory: 'mustache' },
      clues: [{ type: 'victim' }] },
  ],
  solution: { A: { r: 0, c: 1 }, V: { r: 1, c: 3 }, C: { r: 2, c: 0 }, B: { r: 3, c: 4 }, D: { r: 4, c: 2 } },
  murderer: 'B',
};

assignFacing(SAMPLE_PUZZLE);
