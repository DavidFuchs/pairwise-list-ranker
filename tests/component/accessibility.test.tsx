/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ComparisonDeck } from "@/components/comparison/ComparisonDeck";
import { SourceInput } from "@/components/data/SourceInput";
import { AppShell } from "@/components/layout/AppShell";
import { PreviewPane } from "@/components/preview/PreviewPane";
import type { ListItem } from "@/types/list";

const NOW = "2026-08-15T12:00:00.000Z";

function item(id: string, value: ListItem["value"]): ListItem {
  return {
    id,
    listId: "list-1",
    value,
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const pair = { left: item("item-1", "Tacos"), right: item("item-2", "Ramen") };

describe("landmarks", () => {
  it("marks the header, the working area, and the preview", () => {
    render(
      <AppShell
        listName="Dinners"
        onReset={vi.fn()}
        rail={null}
        stage={<span>stage</span>}
        preview={<span>preview</span>}
      />,
    );

    expect(screen.getByRole("banner")).toBeDefined();
    expect(screen.getByRole("main")).toBeDefined();
    expect(screen.getByRole("complementary")).toBeDefined();
  });
});

describe("comparison stage announcements", () => {
  it("announces the pair on offer politely", () => {
    render(
      <ComparisonDeck
        pair={pair}
        progress={{
          activeItems: 3,
          comparisons: 2,
          skips: 0,
          coverage: 0.4,
          earnedCoverage: 0.4,
        }}
        onOutcome={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const live = screen.getByText(/comparing tacos and ramen/i);
    expect(live.closest("[aria-live]")?.getAttribute("aria-live")).toBe(
      "polite",
    );
  });

  it("names the progress meter rather than leaving a bare bar", () => {
    render(
      <ComparisonDeck
        pair={pair}
        progress={{
          activeItems: 3,
          comparisons: 2,
          skips: 0,
          coverage: 0.4,
          earnedCoverage: 0.4,
        }}
        onOutcome={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "40",
    );
  });
});

describe("preview pane", () => {
  it("labels the ranked list for screen readers", () => {
    render(
      <PreviewPane
        tab="ranked"
        tabs={["ranked", "yaml"]}
        ranking={[]}
        exportText=""
        filename="list.yaml"
        format="yaml"
        removedCount={0}
        onReorder={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/current ranking/i)).toBeDefined();
  });

  it("labels the exported text region for screen readers", () => {
    render(
      <PreviewPane
        tab="yaml"
        tabs={["ranked", "yaml"]}
        ranking={[]}
        exportText="movies: []"
        filename="list.yaml"
        format="yaml"
        removedCount={0}
        onReorder={vi.fn()}
        onTabChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText(/yaml export/i)).toBeDefined();
  });
});

describe("source input", () => {
  it("announces parse problems as an alert", () => {
    render(
      <SourceInput
        value="{ broken"
        onChange={vi.fn()}
        override="json"
        onOverrideChange={vi.fn()}
        format="json"
        issues={[{ path: "", message: "Invalid JSON", line: 1 }]}
      />,
    );

    expect(screen.getByRole("alert")).toBeDefined();
  });
});
