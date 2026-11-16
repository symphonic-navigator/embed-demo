// Phones get the Explainer only (the model is too big for them). A phone is a
// small viewport *and* a coarse pointer, so a narrow desktop window or a
// tablet still counts as a computer.
export function isPhone(matchMediaFn = window.matchMedia.bind(window)) {
  return matchMediaFn('(max-width: 600px)').matches && matchMediaFn('(pointer: coarse)').matches
}
