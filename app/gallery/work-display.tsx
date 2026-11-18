import { svgToDataUri } from "@/lib/svg-sanitize";
import { accessionNumber, type Work } from "@/lib/works";
import { findDepartment } from "@/lib/departments";

// Renders one work, whichever medium it is. Shared by the gallery, the
// permanent collection and the archive so a work looks the same wherever
// it appears.
//
// SECURITY: svg_source is model-generated and is NEVER injected with
// dangerouslySetInnerHTML. It is sanitised on the way in
// (lib/svg-sanitize.ts) and rendered here through a data: URI in an <img>,
// which browsers refuse to execute script inside. Two independent
// defences; do not remove either.
export default function WorkDisplay({
  work,
  schoolName,
  variant = "card",
}: {
  work: Work;
  schoolName?: string;
  variant?: "leading" | "card" | "object";
}) {
  const dept = findDepartment(work.department);
  const isVisual = dept?.media === "svg";

  const bodyClass =
    variant === "object" ? "permanent-joke" : "joke-body";

  return (
    <div className={`work-display work-${work.department} work-${variant}`}>
      {isVisual ? (
        <figure className={`plate plate-${work.department}`}>
          {work.image_path ? (
            // Raster mode, if ever enabled: a Storage path, never bytes
            // out of the database.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/works/${work.image_path}`}
              alt={work.title ?? "Untitled work"}
              loading="lazy"
            />
          ) : work.svg_source ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={svgToDataUri(work.svg_source)}
              alt={work.title ?? "Untitled work"}
              loading="lazy"
            />
          ) : (
            <p className="plate-missing">This plate is missing.</p>
          )}
        </figure>
      ) : (
        <blockquote className={bodyClass}>{work.body}</blockquote>
      )}

      {work.title && isVisual && <h3 className="work-plate-title">{work.title}</h3>}
      {work.caption && <p className="work-plate-note">{work.caption}</p>}

      <p className={variant === "object" ? "permanent-meta" : "joke-meta"}>
        {accessionNumber(work)} · {schoolName ?? work.school}
        {work.edited_at && " · reworded by the member"}
      </p>

      {/* Honesty about authorship: once a member rewords a work, the
          model's own wording stays one click away. */}
      {!isVisual && work.original_body && work.original_body !== work.body && (
        <details className="work-original">
          <summary>As the model wrote it</summary>
          <p>{work.original_body}</p>
        </details>
      )}

      {work.accessioned_at && (
        <p className="credit-line">
          Acquired{" "}
          {new Date(work.accessioned_at).toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          . Gift of {work.credit_name ?? "an anonymous donor"}.
        </p>
      )}
    </div>
  );
}
