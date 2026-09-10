/**
 * Motion values shared by the components that animate from JavaScript.
 *
 * EASE is --hi-ease from globals.css. framer-motion cannot take a CSS custom
 * property as an easing, so the curve has to be restated for it — once, here,
 * rather than in each component. Change the two together.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;
