// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  for (const dimension of ["offsetWidth", "offsetHeight"] as const) {
    vi.spyOn(HTMLElement.prototype, dimension, "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.hasAttribute("data-group") ? 1000 : 500;
    });
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each(["horizontal", "vertical"] as const)(
  "renders and resizes a %s group with the keyboard",
  (orientation) => {
    render(
      <ResizablePanelGroup orientation={orientation}>
        <ResizablePanel id="first" defaultSize="50%">
          First panel
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="second" defaultSize="50%">
          Second panel
        </ResizablePanel>
      </ResizablePanelGroup>,
    );
    const separator = screen.getByRole("separator");
    expect(screen.getByText("First panel")).toBeInTheDocument();
    expect(screen.getByText("Second panel")).toBeInTheDocument();
    expect(separator).toHaveAttribute(
      "aria-orientation",
      orientation === "horizontal" ? "vertical" : "horizontal",
    );
    expect(separator).toHaveAttribute("aria-valuenow", "50");
    fireEvent.keyDown(separator, {
      key: orientation === "horizontal" ? "ArrowRight" : "ArrowDown",
    });
    expect(separator).toHaveAttribute("aria-valuenow", "55");
  },
);
