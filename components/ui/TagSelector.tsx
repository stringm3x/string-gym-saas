"use client";

import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Badge } from "@/components/ui/Badge";
import type { Tag } from "@/lib/queries/tags.queries";
import type { BadgeVariant } from "@/components/ui/Badge";

interface TagSelectorProps {
  tags: Tag[];
  initialSelectedIds?: string[];
  name?: string;
  label?: string;
}

export function tagColorToVariant(color: Tag["color"]): BadgeVariant {
  return color as BadgeVariant;
}

export function TagSelector({
  tags,
  initialSelectedIds = [],
  name = "tag_ids",
  label,
}: TagSelectorProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelectedIds)
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (tags.length === 0) return null;

  return (
    <div className="space-y-1.5">
      {label && (
        <p className="text-xs font-medium text-text-secondary">{label}</p>
      )}

      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => {
          const isSelected = selected.has(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggle(tag.id)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all duration-150",
                isSelected
                  ? "ring-2 ring-brand-green ring-offset-1 ring-offset-bg"
                  : "opacity-50 hover:opacity-80"
              )}
            >
              <Badge
                variant={tagColorToVariant(tag.color)}
                className="pointer-events-none border-0 bg-transparent p-0 text-inherit"
              >
                {tag.nombre}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Hidden inputs para form submission */}
      {Array.from(selected).map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
    </div>
  );
}

/** Renderiza tags como badges read-only (para tabla/cards). */
export function TagBadges({
  tags,
  max = 3,
}: {
  tags: Tag[];
  max?: number;
}) {
  if (tags.length === 0) return null;

  const visible = tags.slice(0, max);
  const extra = tags.length - max;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <Badge key={tag.id} variant={tagColorToVariant(tag.color)}>
          {tag.nombre}
        </Badge>
      ))}
      {extra > 0 && (
        <span className="text-xs text-text-muted">+{extra}</span>
      )}
    </div>
  );
}
