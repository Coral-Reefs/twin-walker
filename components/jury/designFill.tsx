/** Each design gets a colour AND a fill pattern, so bars and swatches work without colour. */
export const DESIGN_FILL: Record<string, { color: string; pattern: "dots" | "stripes" | "solid" }> = {
  "shaded-seating": { color: "#15803d", pattern: "solid" },
  "crossing-reposition": { color: "#1d4ed8", pattern: "stripes" },
  "family-pickup": { color: "#b45309", pattern: "dots" },
};

/** Rendered once per page; charts and swatches reference these by id. */
export function DesignPatternDefs() {
  return (
    <svg width={0} height={0} aria-hidden="true" focusable="false" className="absolute">
      <defs>
        {Object.entries(DESIGN_FILL).map(([id, f]) => (
          <pattern key={id} id={`fill-${id}`} width="8" height="8" patternUnits="userSpaceOnUse">
            <rect width="8" height="8" fill={f.color} />
            {f.pattern === "stripes" && <path d="M-2 2l4-4M0 8l8-8M6 10l4-4" stroke="#ffffff" strokeWidth="2" />}
            {f.pattern === "dots" && <circle cx="4" cy="4" r="1.6" fill="#ffffff" />}
          </pattern>
        ))}
      </defs>
    </svg>
  );
}
