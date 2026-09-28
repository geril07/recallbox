# Recallbox brand reference

![Letter studies](letter-studies.png)

The selected direction is **B**, the soft lowercase **r** in the top-middle cell. `letter-studies.png` is the exact, unmodified generated concept sheet approved by the user. Keep it as a reference; do not replace it with a new generation.

The production mark should preserve B’s tapered stem and asymmetric curved shoulder. Use neutral off-white and charcoal for the app interface. Color can remain for deck identification and review grades.

The concept sheet is a visual reference, not a font or production icon asset. It is not evidence of trademark clearance.

## Production assets

- `public/brand-mark.svg` traces the silhouette of B from the reference sheet. It uses a single filled path, with no font dependency. The sidebar uses this SVG as a mask, so the mark follows the theme’s text color.
- `scripts/build-icons.mjs` embeds that same SVG in a charcoal tile. Run `npm run icons` to regenerate the SVG favicon and 192/512-pixel PNG icons. Do not edit those generated files independently.
- `public/icon-maskable-512.png` has an opaque background. The complete letter fits within the central circle with a radius of 40% of the icon width, as required by the [maskable icon safe zone](https://web.dev/articles/maskable-icon).
- The interface palette is defined in `src/index.css`. Neutral colors apply to surfaces, text, navigation, primary actions, review summaries, charts, and focus states. Deck identification, review grades, and destructive actions retain functional color.
