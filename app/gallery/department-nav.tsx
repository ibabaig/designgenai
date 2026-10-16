import Link from "next/link";
import { DEPARTMENTS } from "@/lib/departments";

// The museum's floor navigation. A visitor walks into a department rather
// than filtering a mixed feed — this is the separation between the four
// media.
export default function DepartmentNav({
  active,
  counts,
}: {
  active?: string;
  counts?: Record<string, number>;
}) {
  return (
    <nav className="department-nav" aria-label="Departments">
      {DEPARTMENTS.map((d) => {
        const n = counts?.[d.slug] ?? 0;
        return (
          <Link
            key={d.slug}
            href={`/gallery/${d.slug}`}
            className={active === d.slug ? "is-active" : undefined}
            aria-current={active === d.slug ? "page" : undefined}
          >
            <strong>{d.shortName}</strong>
            <small>{n === 0 ? "empty" : `${n} on view`}</small>
          </Link>
        );
      })}
    </nav>
  );
}
