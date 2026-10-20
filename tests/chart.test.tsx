// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { expect, it, vi } from "vitest";
import { ChartContainer, ChartLegendContent, ChartTooltipContent } from "@/components/ui/chart";

vi.mock("recharts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("recharts")>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
}));

const config = { pages: { label: "Pages read", color: "#123456" } };
const payload = [
  {
    graphicalItemId: "pages",
    name: "pages",
    dataKey: "pages",
    value: 0,
    color: "#123456",
    payload: {},
  },
];

it("renders a configured tooltip label and a formatted zero value", () => {
  render(
    <ChartContainer config={config}>
      <ChartTooltipContent active payload={payload} label="Monday" />
    </ChartContainer>,
  );
  expect(screen.getByText("Monday")).toBeInTheDocument();
  expect(screen.getByText("Pages read")).toBeInTheDocument();
  expect(screen.getByText("0")).toHaveClass("tabular-nums");
});

it("passes the complete tooltip payload to custom formatters", () => {
  const formatter = vi.fn(() => "Custom value");
  render(
    <ChartContainer config={config}>
      <ChartTooltipContent active payload={payload} formatter={formatter} />
    </ChartContainer>,
  );
  expect(formatter).toHaveBeenCalledWith(0, "pages", payload[0], 0, payload);
  expect(screen.getByText("Custom value")).toBeInTheDocument();
});

it("renders custom legend entries from the content payload", () => {
  render(
    <ChartContainer config={config}>
      <ChartLegendContent payload={[{ value: "pages", dataKey: "pages", color: "#123456" }]} />
    </ChartContainer>,
  );
  expect(screen.getByText("Pages read")).toBeInTheDocument();
});
