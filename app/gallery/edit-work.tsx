"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import WorkEditor from "./work-editor";
import type { EditableDepartment } from "@/lib/work-limits";

// On the wall, beside Withdraw: only rendered for your own humour or
// poetry from today that has not been acquired. RLS and the 012 trigger
// are the real guard; this is the affordance.
export default function EditWork({
  workId,
  department,
  body,
}: {
  workId: number;
  department: EditableDepartment;
  body: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className="withdraw-link" onClick={() => setOpen(true)}>
        Reword
      </button>
    );
  }

  return (
    <div className="edit-work-panel">
      <WorkEditor
        workId={workId}
        department={department}
        initial={body}
        autoFocus
        cancelLabel="Close"
        onCancel={() => setOpen(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}
