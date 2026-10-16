"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Icon } from "./Icon";

interface Props {
  /** Short name of the panel, used in the fallback message. */
  name: string;
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Keeps one broken panel from taking down the whole demo. */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[DayZero] ${this.props.name} crashed`, error, info.componentStack);
  }

  override render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl border border-bad/40 bg-bad-soft p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-bad">
          <Icon name="warning" size={18} /> The {this.props.name} couldn&rsquo;t be shown.
        </p>
        <p className="mt-1 text-ink">The rest of DayZero still works. You can try loading this panel again.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 font-semibold"
        >
          <Icon name="refresh" size={16} /> Try again
        </button>
      </div>
    );
  }
}
