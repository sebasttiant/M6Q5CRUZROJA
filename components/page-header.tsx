import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h1 className="text-3xl font-black tracking-tight text-ink sm:text-4xl">{title}</h1>{description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{description}</p> : null}</div>{action}</div>;
}
