"use client";

import { Icon } from "@/components/system/Icon";
import type { Persona } from "@/lib/simulation/types";
import { PERSONA_ICON, personaColor } from "@/lib/ui/styles";

interface Props {
  personas: Persona[];
  selectedId: string;
  onSelect: (id: string) => void;
}

/** Native radio group: arrow keys move between personas; the checked state is announced natively. */
export function PersonaPicker({ personas, selectedId, onSelect }: Props) {
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold text-ink-muted">Choose a future resident</legend>
      <div className="grid grid-cols-2 gap-2.5">
        {personas.map((p) => {
          const selected = p.id === selectedId;
          const color = personaColor(p.id);
          return (
            <label
              key={p.id}
              className={`relative flex cursor-pointer items-start gap-2.5 rounded-xl border-2 bg-white p-3 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus ${
                selected ? "shadow-sm" : "border-line hover:border-stone-400"
              }`}
              style={selected ? { borderColor: color } : undefined}
            >
              <input
                type="radio"
                name="persona"
                value={p.id}
                checked={selected}
                onChange={() => onSelect(p.id)}
                className="sr-only"
              />
              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                style={{ background: color }}
              >
                <Icon name={PERSONA_ICON[p.icon]} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold leading-tight text-ink">{p.name}</span>
                <span className="block text-xs leading-snug text-ink-muted">{p.role}</span>
              </span>
              {selected && (
                <span
                  aria-hidden="true"
                  className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-white"
                  style={{ background: color }}
                >
                  <Icon name="check" size={13} strokeWidth={3} />
                </span>
              )}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
