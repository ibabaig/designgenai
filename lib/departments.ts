// The four departments of the Museum of Digital Art.
//
// A real museum separates media by department and you navigate by walking
// into one. That is the separation here: you enter Poetry, you are in
// Poetry. A mixed feed with a type filter makes the visitor do the
// curator's job.
//
// All four share the day's wing subject, so the whole museum works on one
// theme in four media.

export type DepartmentSlug = "humour" | "poetry" | "prints" | "film";

/** text -> body; svg -> svg_source (and image_path if raster is ever on) */
export type MediaKind = "text" | "svg";

export type Department = {
  slug: DepartmentSlug;
  name: string;
  shortName: string;
  blurb: string;
  media: MediaKind;
  /** SVG canvas. Prints hang portrait, Film is a widescreen frame. */
  canvas: { w: number; h: number };
  order: number;
};

export const DEPARTMENTS: Department[] = [
  {
    slug: "humour",
    name: "Department of Humour",
    shortName: "Humour",
    blurb: "Short works. A visitor reads them standing up.",
    media: "text",
    canvas: { w: 0, h: 0 },
    order: 1,
  },
  {
    slug: "poetry",
    name: "Department of Poetry",
    shortName: "Poetry",
    blurb: "Verse and prose-verse, hung as broadsides.",
    media: "text",
    canvas: { w: 0, h: 0 },
    order: 2,
  },
  {
    slug: "prints",
    name: "Department of Prints",
    shortName: "Prints",
    blurb: "Limited-palette compositions, drawn in vector and printed to the wall.",
    media: "svg",
    canvas: { w: 600, h: 800 },
    order: 3,
  },
  {
    slug: "film",
    name: "Department of Film",
    shortName: "Film",
    blurb: "A single frame and its logline. The rest of the picture is yours.",
    media: "svg",
    canvas: { w: 960, h: 540 },
    order: 4,
  },
];

export function findDepartment(slug: string): Department | undefined {
  return DEPARTMENTS.find((d) => d.slug === slug);
}

export function isDepartmentSlug(slug: string): slug is DepartmentSlug {
  return DEPARTMENTS.some((d) => d.slug === slug);
}

// ---------------------------------------------------------------
// THE HOUSE PALETTE
// ---------------------------------------------------------------
// Every generated print and film still is restricted to these five inks,
// which are the site's own CSS custom properties plus the two card tones
// already used in museum.css. Two reasons, and the second matters more:
//
//   1. A shared palette makes the collection look like one museum rather
//      than a pile of unrelated model output.
//   2. It is a quality floor. A language model asked for "an image"
//      produces mush; asked to compose within five named inks on a fixed
//      canvas, it produces something that reads as designed.
//
// Black, red and two light tones on cream is also a real risograph set,
// which is why plates come out looking printed rather than rendered.
export const INKS = {
  paper: "#F3F1EB",
  ink: "#121212",
  signal: "#E62B24",
  stone: "#D8DAD4",
  bone: "#E7E0D4",
} as const;

export const PALETTE_FOR_PROMPT = Object.entries(INKS)
  .map(([name, hex]) => `${name} ${hex}`)
  .join(", ");
