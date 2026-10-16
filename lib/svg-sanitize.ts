// Sanitiser for model-generated SVG.
//
// WHY THIS FILE EXISTS
// The Prints and Film departments ask a language model to write SVG,
// and SVG is not an image format -- it is a document format that can
// carry <script>, event handlers, <foreignObject> with arbitrary HTML,
// and external references that phone home. Rendering model output
// inline without sanitising it is a stored-XSS hole where the payload
// is written by whatever the model felt like emitting, or by anything
// a user managed to get the model to emit.
//
// Two independent defences, because either alone could fail:
//   1. This allowlist. Elements and attributes not named here are
//      dropped. An allowlist, never a blocklist -- blocklists lose to
//      the next attribute someone thinks of.
//   2. Rendering through `svgToDataUri()` into an <img src="data:...">.
//      Browsers do not execute script in SVG loaded as an image, so
//      even a sanitiser bug is contained.
//
// Never render `svg_source` with dangerouslySetInnerHTML.

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "rect", "circle", "ellipse", "line", "polyline",
  "polygon", "path", "title", "desc",
]);

const ALLOWED_ATTRIBUTES = new Set([
  "viewBox", "xmlns", "width", "height",
  "x", "y", "cx", "cy", "r", "rx", "ry", "x1", "y1", "x2", "y2",
  "d", "points", "transform",
  "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "opacity", "fill-opacity", "stroke-opacity",
  "fill-rule", "clip-rule",
]);

// Attribute values may not reference anything outside the document.
const FORBIDDEN_VALUE = /(javascript:|data:|url\s*\(|<|&#|expression\s*\()/i;

export type SanitiseResult =
  | { ok: true; svg: string }
  | { ok: false; reason: string };

export function sanitiseSvg(
  raw: string,
  canvas: { w: number; h: number }
): SanitiseResult {
  // Models like to wrap output in fences or prose. Take the first
  // <svg> element and discard everything around it.
  const match = raw.match(/<svg[\s\S]*<\/svg>/i);
  if (!match) return { ok: false, reason: "No <svg> element in the output." };

  let svg = match[0];

  // Size guard before any parsing work.
  if (svg.length > 60_000) {
    return { ok: false, reason: "SVG is too large (over 60KB)." };
  }

  // Comments and CDATA can hide markup from a naive tag scan.
  svg = svg.replace(/<!--[\s\S]*?-->/g, "").replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");

  // Drop forbidden elements AND their contents, not just their tags --
  // removing only <script> while keeping its body would leave the
  // payload as text that a later parse could resurrect.
  for (const tag of ["script", "style", "foreignObject", "use", "image",
                     "animate", "animateTransform", "animateMotion", "set",
                     "a", "iframe", "object", "embed", "handler"]) {
    svg = svg.replace(
      new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), ""
    );
    svg = svg.replace(new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi"), "");
  }

  // Rebuild every remaining tag from the allowlist. Anything not
  // explicitly permitted does not survive this pass.
  let dropped = 0;
  svg = svg.replace(/<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)\/?>/g,
    (whole, rawName: string, rawAttrs: string) => {
      const name = rawName.toLowerCase();
      const canonical = [...ALLOWED_ELEMENTS].find((e) => e.toLowerCase() === name);

      if (!canonical) {
        dropped += 1;
        return "";
      }
      if (whole.startsWith("</")) return `</${canonical}>`;

      const keep: string[] = [];
      const attrRe = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
      let m: RegExpExecArray | null;

      while ((m = attrRe.exec(rawAttrs)) !== null) {
        const attr = m[1];
        const value = m[3] ?? m[4] ?? "";
        const allowed = [...ALLOWED_ATTRIBUTES].find(
          (a) => a.toLowerCase() === attr.toLowerCase()
        );

        // Every on* handler is excluded by the allowlist already; this
        // is belt and braces, and it is cheap.
        if (!allowed) continue;
        if (/^on/i.test(attr)) continue;
        if (FORBIDDEN_VALUE.test(value)) continue;

        keep.push(`${allowed}="${value.replace(/"/g, "&quot;")}"`);
      }

      const selfClosing = whole.endsWith("/>") &&
        !["svg", "g", "title", "desc"].includes(canonical);
      return `<${canonical}${keep.length ? " " + keep.join(" ") : ""}${selfClosing ? "/" : ""}>`;
    });

  if (dropped > 40) {
    return { ok: false, reason: "Output was mostly disallowed markup." };
  }

  // Force our own canvas regardless of what the model asked for, so a
  // work cannot break the gallery layout by declaring a huge viewBox.
  svg = svg.replace(
    /<svg\b[^>]*>/i,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.w} ${canvas.h}" width="100%" height="100%">`
  );

  if (!/<(rect|circle|ellipse|path|polygon|polyline|line)\b/i.test(svg)) {
    return { ok: false, reason: "SVG contains no drawable shapes." };
  }

  return { ok: true, svg };
}

// Render path. Produces a src for an <img>, which is the containment
// boundary: browsers never run script in SVG loaded this way.
export function svgToDataUri(svg: string): string {
  const encoded =
    typeof Buffer !== "undefined"
      ? Buffer.from(svg, "utf8").toString("base64")
      : btoa(unescape(encodeURIComponent(svg)));
  return `data:image/svg+xml;base64,${encoded}`;
}
