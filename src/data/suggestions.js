// Clickable query chips above the results, so nobody faces an empty search
// box. Keep in step with SUGGESTIONS in tools/model/embed_demo_set.py.
export const DEMO_SUGGESTIONS = [
  'un chat qui dort',
  'the train is late again',
  'Ich trinke gern Kaffee',
  'il pleut toute la journée',
  'お金を払う',
  'spring flowers',
]

// Chosen against the real similarities of the demo set (see
// src/data/defaults.test.js): with the first chip, the p line sits above the
// k line, so rank 4 shows "p too low"; raising the temperature brings it back.
export const DEFAULTS = { k: 4, p: 0.8, temperature: 0.05 }

export const SLIDERS = {
  k: { min: 1, max: 10, step: 1 },
  p: { min: 0.05, max: 1, step: 0.01 },
  temperature: { min: 0.02, max: 0.5, step: 0.01 }, // must stay above 0
}
