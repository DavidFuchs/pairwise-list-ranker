/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProgressMeter } from "@/components/ui/ProgressMeter";

function meter() {
  return screen.getByRole("progressbar");
}

function run(fill: string) {
  return meter().querySelector(`[data-fill="${fill}"]`) as HTMLElement | null;
}

/**
 * A list marked already ranked is credited the whole estimate on its word, so
 * the bar has to separate the run comparisons paid for from the run the import
 * was given. Without it, an assertion and an afternoon of work draw the same
 * full accent bar.
 */
describe("ProgressMeter claimed run", () => {
  it("hatches the whole bar for a ranked import nobody has compared yet", () => {
    render(
      <ProgressMeter
        coverage={1}
        earnedCoverage={0}
        accessibilityLabel="Ranking progress"
      />,
    );

    expect(run("claimed")?.style.width).toBe("100%");
    expect(run("meter")?.style.width).toBe("0%");
    expect(run("surplus")).toBeNull();
  });

  it("turns the claim solid from the left as comparisons land", () => {
    render(
      <ProgressMeter
        coverage={1.5}
        earnedCoverage={0.5}
        accessibilityLabel="Ranking progress"
      />,
    );

    // The three runs tile rather than overlap: earned, then claimed, with the
    // gold laid over the earned end.
    expect(run("meter")?.style.width).toBe("50%");
    expect(run("claimed")?.style.left).toBe("50%");
    expect(run("claimed")?.style.width).toBe("50%");
    expect(run("surplus")?.style.width).toBe("50%");
  });

  it("leaves no hatching once comparisons alone cover the estimate", () => {
    render(
      <ProgressMeter
        coverage={2}
        earnedCoverage={1}
        accessibilityLabel="Ranking progress"
      />,
    );

    expect(run("claimed")).toBeNull();
    expect(run("meter")?.style.width).toBe("100%");
  });

  it("hatches nothing on a list with no credit to strip", () => {
    render(
      <ProgressMeter coverage={0.52} accessibilityLabel="Ranking progress" />,
    );

    expect(run("claimed")).toBeNull();
    expect(run("meter")?.style.width).toBe("52%");
  });

  it("says the run is credited rather than earned, since colour cannot", () => {
    render(
      <ProgressMeter
        coverage={1}
        earnedCoverage={0}
        accessibilityLabel="Ranking progress"
      />,
    );

    expect(meter().getAttribute("aria-valuenow")).toBe("100");
    expect(meter().getAttribute("aria-valuetext")).toMatch(
      /credited to the order you imported/i,
    );
  });
});
