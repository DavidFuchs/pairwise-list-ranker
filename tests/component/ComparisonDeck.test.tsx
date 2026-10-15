/** @vitest-environment jsdom */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ComparisonDeck } from "@/components/comparison/ComparisonDeck";
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

function setup(
  overrides: Partial<React.ComponentProps<typeof ComparisonDeck>> = {},
) {
  const props = {
    pair,
    progress: {
      activeItems: 3,
      comparisons: 2,
      skips: 0,
      coverage: 0.4,
      earnedCoverage: 0.4,
    },
    onOutcome: vi.fn(),
    onDelete: vi.fn(),
    ...overrides,
  };
  render(<ComparisonDeck {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe("ComparisonDeck layout", () => {
  it("shows both items of the pair", () => {
    setup();

    expect(screen.getByText("Tacos")).toBeDefined();
    expect(screen.getByText("Ramen")).toBeDefined();
  });

  it("reports how much comparing has been done", () => {
    setup();

    expect(screen.getByText(/2 comparisons/i)).toBeDefined();
    expect(screen.getByText(/3 items/i)).toBeDefined();
  });

  it("keeps each item’s actions inside its own card", () => {
    setup();

    // The card itself is the choice, so it carries that accessible name.
    const leftCard = screen.getByLabelText("Choose Tacos");
    expect(
      within(leftCard).getByRole("button", { name: "Tacos is much better" }),
    ).toBeDefined();
    expect(
      within(leftCard).getByRole("button", { name: "Delete Tacos" }),
    ).toBeDefined();
    expect(within(leftCard).queryByLabelText("Choose Ramen")).toBeNull();
  });

  it("stays quiet about the estimate while it is still ahead", () => {
    setup();

    expect(screen.queryByText(/sorted well enough/i)).toBeNull();
  });

  it("says the list is sorted, and that carrying on still helps, once the estimate is met", () => {
    setup({
      progress: {
        activeItems: 3,
        comparisons: 5,
        skips: 0,
        coverage: 1,
        earnedCoverage: 1,
      },
    });

    const note = screen.getByText(/sorted well enough/i);
    expect(note.textContent).toMatch(/keep going/i);
  });

  it("offers one shared skip rather than one per card", () => {
    setup();

    expect(
      screen.getAllByRole("button", { name: /skip this pair/i }),
    ).toHaveLength(1);
  });
});

describe("the progress meter", () => {
  function meter() {
    return screen.getByRole("progressbar", { name: /ranking progress/i });
  }

  it("reports the percentage reached", () => {
    setup();

    expect(meter().getAttribute("aria-valuenow")).toBe("40");
    expect(screen.getByText("40%")).toBeDefined();
  });

  it("shows no plating before the estimate is met", () => {
    setup();

    expect(meter().querySelector('[data-fill="surplus"]')).toBeNull();
  });

  it("counts past 100% once the estimate is beaten", () => {
    setup({
      progress: {
        activeItems: 3,
        comparisons: 9,
        skips: 0,
        coverage: 1.32,
        earnedCoverage: 1.32,
      },
    });

    expect(screen.getByText("132%")).toBeDefined();
  });

  it("plates the full bar in gold past the estimate", () => {
    setup({
      progress: {
        activeItems: 3,
        comparisons: 9,
        skips: 0,
        coverage: 1.32,
        earnedCoverage: 1.32,
      },
    });

    const surplus = meter().querySelector('[data-fill="surplus"]');

    expect(surplus).not.toBeNull();
    expect((surplus as HTMLElement).style.width).toBe("32%");
  });

  it("stops widening the plating once it is fully gold", () => {
    setup({
      progress: {
        activeItems: 3,
        comparisons: 30,
        skips: 0,
        coverage: 3.4,
        earnedCoverage: 3.4,
      },
    });

    const surplus = meter().querySelector('[data-fill="surplus"]');

    expect((surplus as HTMLElement).style.width).toBe("100%");
  });

  it("caps the number where the plating stops, rather than climbing forever", () => {
    setup({
      progress: {
        activeItems: 3,
        comparisons: 30,
        skips: 0,
        coverage: 3.4,
        earnedCoverage: 3.4,
      },
    });

    expect(screen.getByText("200%+")).toBeDefined();
    expect(meter().getAttribute("aria-valuetext")).toMatch(
      /over 200%.*past the estimate/i,
    );
  });

  it("keeps the progressbar contract valid while saying it went past", () => {
    setup({
      progress: {
        activeItems: 3,
        comparisons: 9,
        skips: 0,
        coverage: 1.32,
        earnedCoverage: 1.32,
      },
    });

    // aria-valuenow must stay within min/max, so the surplus is spoken instead.
    expect(meter().getAttribute("aria-valuenow")).toBe("100");
    expect(meter().getAttribute("aria-valuemax")).toBe("100");
    expect(meter().getAttribute("aria-valuetext")).toMatch(
      /132%.*past the estimate/i,
    );
  });
});

describe("choosing a winner", () => {
  it("reports a win for the left item", async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByLabelText("Choose Tacos"));

    expect(onOutcome).toHaveBeenCalledWith("left");
  });

  it("reports a win for the right item", async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByLabelText("Choose Ramen"));

    expect(onOutcome).toHaveBeenCalledWith("right");
  });

  it("reports a much-better win as a strong outcome", async () => {
    const { onOutcome, user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Tacos is much better" }),
    );

    expect(onOutcome).toHaveBeenCalledWith("left_strong");
  });

  it("reports a much-better win for the right item", async () => {
    const { onOutcome, user } = setup();

    await user.click(
      screen.getByRole("button", { name: "Ramen is much better" }),
    );

    expect(onOutcome).toHaveBeenCalledWith("right_strong");
  });

  it("reports a skip", async () => {
    const { onOutcome, user } = setup();

    await user.click(screen.getByRole("button", { name: /skip this pair/i }));

    expect(onOutcome).toHaveBeenCalledWith("skip");
  });
});

describe("deleting from a card", () => {
  it("asks for confirmation before deleting", async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete Tacos" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /confirm deleting tacos/i }),
    ).toBeDefined();
  });

  it("asks inside the card being deleted", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete Tacos" }));

    const leftCard = screen.getByLabelText(/left option: tacos/i);
    expect(
      within(leftCard).getByRole("button", { name: /confirm deleting tacos/i }),
    ).toBeDefined();
  });

  it("deletes by item id once confirmed", async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete Tacos" }));
    await user.click(
      screen.getByRole("button", { name: /confirm deleting tacos/i }),
    );

    expect(onDelete).toHaveBeenCalledWith("item-1");
  });

  it("lets the user back out", async () => {
    const { onDelete, user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete Tacos" }));
    await user.click(screen.getByRole("button", { name: /keep tacos/i }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete Tacos" })).toBeDefined();
  });

  it("hides the choose action while a delete is pending", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete Tacos" }));

    expect(screen.queryByLabelText("Choose Tacos")).toBeNull();
    expect(screen.getByLabelText("Choose Ramen")).toBeDefined();
  });

  it("drops a pending delete when the user picks a winner instead", async () => {
    const { onDelete, onOutcome, user } = setup();

    await user.click(screen.getByRole("button", { name: "Delete Tacos" }));
    await user.click(screen.getByLabelText("Choose Ramen"));

    expect(onOutcome).toHaveBeenCalledWith("right");
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("keyboard shortcuts", () => {
  it("chooses the left item with the left arrow key", async () => {
    const { onOutcome, user } = setup();

    await user.keyboard("{ArrowLeft}");

    expect(onOutcome).toHaveBeenCalledWith("left");
  });

  it("chooses the right item with the right arrow key", async () => {
    const { onOutcome, user } = setup();

    await user.keyboard("{ArrowRight}");

    expect(onOutcome).toHaveBeenCalledWith("right");
  });

  it("marks a much-better win with shift and an arrow key", async () => {
    const { onOutcome, user } = setup();

    await user.keyboard("{Shift>}{ArrowRight}{/Shift}");

    expect(onOutcome).toHaveBeenCalledWith("right_strong");
  });

  it("skips with the s key", async () => {
    const { onOutcome, user } = setup();

    await user.keyboard("s");

    expect(onOutcome).toHaveBeenCalledWith("skip");
  });

  it("arms a delete with d then l, rather than deleting outright", async () => {
    const { onDelete, user } = setup();

    await user.keyboard("dl");

    expect(onDelete).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /confirm deleting tacos/i }),
    ).toBeDefined();
  });

  it("arms the right item with d then r", async () => {
    const { user } = setup();

    await user.keyboard("dr");

    expect(
      screen.getByRole("button", { name: /confirm deleting ramen/i }),
    ).toBeDefined();
  });

  it("confirms an armed delete with enter", async () => {
    const { onDelete, user } = setup();

    await user.keyboard("dl{Enter}");

    expect(onDelete).toHaveBeenCalledWith("item-1");
  });

  it("cancels an armed delete with escape", async () => {
    const { onDelete, user } = setup();

    await user.keyboard("dl{Escape}");

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete Tacos" })).toBeDefined();
  });

  it("ignores shortcuts while the user is typing in a text field", async () => {
    const { onOutcome, user } = setup();
    const field = window.document.createElement("textarea");
    window.document.body.appendChild(field);
    field.focus();

    await user.keyboard("{ArrowLeft}s");

    expect(onOutcome).not.toHaveBeenCalled();
    field.remove();
  });

  it("tells the user the shortcuts exist", () => {
    setup();

    expect(screen.getByText(/arrow keys choose/i)).toBeDefined();
    expect(screen.getByText(/s skips/i)).toBeDefined();
  });

  it("says which key finishes the delete it is halfway through", async () => {
    const { user } = setup();

    await user.keyboard("d");

    expect(screen.getByText(/press L or R/i)).toBeDefined();
  });

  it("drops a half-typed delete when the pair is answered by pointer", async () => {
    const { user } = setup();

    await user.keyboard("d");
    await user.click(screen.getByLabelText("Choose Tacos"));

    expect(screen.queryByText(/press L or R/i)).toBeNull();
  });

  it("names the keys that answer the confirmation", async () => {
    const { user } = setup();

    await user.keyboard("dl");

    const confirm = screen.getByRole("alert");
    expect(within(confirm).getByText("Enter")).toBeDefined();
    expect(within(confirm).getByText("Esc")).toBeDefined();
    expect(screen.getByText(/enter removes/i)).toBeDefined();
  });

  it("moves focus to the confirmation, and back to the trash can on a keep", async () => {
    const { user } = setup();

    await user.keyboard("dl");
    expect(window.document.activeElement).toBe(screen.getByRole("alert"));

    await user.keyboard("{Escape}");
    expect(window.document.activeElement).toBe(
      screen.getByRole("button", { name: "Delete Tacos" }),
    );
  });

  it("lets a focused confirmation button answer for itself", async () => {
    const { onDelete, user } = setup();

    await user.keyboard("dl");
    const keep = screen.getByRole("button", { name: "Keep Tacos" });
    keep.focus();
    await user.keyboard("{Enter}");

    // The global Enter binding must not fire the destructive action out from
    // under a button whose own label says "Keep".
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Delete Tacos" })).toBeDefined();
  });

  it("stays quiet when there is no pair to act on", async () => {
    const { onOutcome, user } = setup({
      pair: null,
      progress: {
        activeItems: 1,
        comparisons: 0,
        skips: 0,
        coverage: 0,
        earnedCoverage: 0,
      },
    });

    await user.keyboard("{ArrowLeft}");

    expect(onOutcome).not.toHaveBeenCalled();
  });
});

describe("states with nothing to compare", () => {
  it("explains itself when there is nothing left to compare", () => {
    setup({
      pair: null,
      progress: {
        activeItems: 1,
        comparisons: 0,
        skips: 0,
        coverage: 0,
        earnedCoverage: 0,
      },
    });

    expect(screen.getByText(/at least two items/i)).toBeDefined();
    expect(screen.queryByLabelText(/^Choose /)).toBeNull();
  });

  // Ranking can no longer start without a label field - the data screen blocks
  // it - so the deck has no such state left to render.
});

describe("the gutter", () => {
  it('separates the two cards with an "or"', () => {
    setup();

    expect(screen.getByText("or")).toBeDefined();
  });

  it("keeps the skip action for the pair", () => {
    setup();

    expect(
      screen.getByRole("button", { name: /skip this pair/i }),
    ).toBeDefined();
  });

  it("keeps the cards free of keycaps", () => {
    setup();

    expect(screen.queryByText("←")).toBeNull();
    expect(screen.queryByText("→")).toBeNull();
  });
});

describe("details, shared by the pair", () => {
  const films = [
    { title: "Arrival", synopsis: "Linguist meets heptapods." },
    { title: "Alien", synopsis: "Crew meets xenomorph." },
  ];

  function withDetails() {
    return setup({
      pair: {
        left: {
          id: "item-1",
          listId: "list-1",
          value: films[0]!,
          active: true,
          createdAt: NOW,
          updatedAt: NOW,
        },
        right: {
          id: "item-2",
          listId: "list-1",
          value: films[1]!,
          active: true,
          createdAt: NOW,
          updatedAt: NOW,
        },
      },
      sortField: "title",
    });
  }

  it("offers one toggle for the pair", () => {
    withDetails();

    expect(
      screen.getAllByRole("switch", { name: /show details on both cards/i }),
    ).toHaveLength(1);
  });

  it("opens both cards at once", async () => {
    const user = userEvent.setup();
    withDetails();

    await user.click(
      screen.getByRole("switch", { name: /show details on both cards/i }),
    );

    expect(screen.getByText(/Linguist meets heptapods/)).toBeDefined();
    expect(screen.getByText(/Crew meets xenomorph/)).toBeDefined();
  });

  it("closes both cards at once", async () => {
    const user = userEvent.setup();
    withDetails();
    const toggle = screen.getByRole("switch", {
      name: /show details on both cards/i,
    });

    await user.click(toggle);
    await user.click(toggle);

    expect(screen.queryByText(/Linguist meets heptapods/)).toBeNull();
    expect(screen.queryByText(/Crew meets xenomorph/)).toBeNull();
  });

  it("stays hidden when the items are bare strings", () => {
    setup();

    expect(screen.queryByRole("switch", { name: /show details/i })).toBeNull();
  });
});

describe("ComparisonDeck undo and stability", () => {
  it("offers Undo only when there is something to undo", () => {
    setup();
    expect(screen.queryByRole("button", { name: /undo/i })).toBeNull();
  });

  it("undoes from the button and from Ctrl+Z", async () => {
    const { user, onUndo } = setup({ onUndo: vi.fn() });

    await user.click(screen.getByRole("button", { name: /undo/i }));
    await user.keyboard("{Control>}z{/Control}");

    expect(onUndo).toHaveBeenCalledTimes(2);
  });

  it("reports how many neighbouring pairs are still unsettled", () => {
    setup({ stability: { pairs: 5, unresolved: 2 } });
    expect(screen.getByText(/2 neighbouring pairs still too close/)).toBeDefined();
  });
});
