# Design Notes

This file summarises the fonts and colour scheme as currently defined in the application styles.

## Fonts

The site uses a mix of Google fonts and a local display face, wired through CSS variables in [layout.tsx](file:///Users/t333btc/Documents/trae_projects/biases/src/app/layout.tsx) and [globals.css](file:///Users/t333btc/Documents/trae_projects/biases/src/app/globals.css).

- Geist Sans is the primary body font via `--font-geist-sans`
- Geist Mono is available for code and numeric UI via `--font-geist-mono`
- Block Script is the display font for headings via `--font-block-script`

## Colour Scheme

The palette is a deep green “bottle” range with glassy overlays and a dark background, defined in [globals.css](file:///Users/t333btc/Documents/trae_projects/biases/src/app/globals.css).

- Bottle green scale: `#001a00`, `#002400`, `#003b00`, `#004d00`, `#006600`, `#008000`
- Glass surface: `rgba(255, 255, 255, 0.05)`
- Glass border: `rgba(255, 255, 255, 0.1)`
- Glass highlight: `rgba(255, 255, 255, 0.2)`
- Background base: `#050a08` with a radial gradient towards `#0f2e26`
- Foreground text: `#f0fdf4`
- Text glow: `rgba(74, 222, 128, 0.3)`

## Usage Notes

These values are applied through utility classes and custom properties rather than a separate design token file.

- `font-heading` applies the Block Script face to display titles
- `glass-panel` and `glass-button` use the glass surface and border values for depth
