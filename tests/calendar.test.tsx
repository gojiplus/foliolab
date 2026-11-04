// @vitest-environment jsdom

import type { DateRange } from "@daypicker/react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, it } from "vitest";
import { Calendar } from "@/components/ui/calendar";

function SingleDateExample() {
  const [selected, setSelected] = useState<Date>();
  return (
    <Calendar
      mode="single"
      defaultMonth={new Date(2026, 2, 1)}
      selected={selected}
      onSelect={setSelected}
      disabled={new Date(2026, 3, 14)}
    />
  );
}

function DateRangeExample() {
  const [selected, setSelected] = useState<DateRange>();
  return (
    <Calendar
      mode="range"
      defaultMonth={new Date(2026, 3, 1)}
      selected={selected}
      onSelect={setSelected}
    />
  );
}

it("navigates months, selects dates, and prevents disabled dates from being selected", async () => {
  const user = userEvent.setup();
  render(<SingleDateExample />);
  await user.click(screen.getByRole("button", { name: /next month/i }));
  expect(screen.getByText("April 2026")).toBeInTheDocument();
  const disabled = screen.getByRole("button", { name: /April 14th, 2026/ });
  expect(disabled).toBeDisabled();
  await user.click(disabled);
  expect(screen.queryAllByRole("gridcell", { selected: true })).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: /April 15th, 2026/ }));
  expect(screen.getByRole("button", { name: /April 15th, 2026, selected/ })).toBeInTheDocument();
  await user.keyboard("{ArrowRight}{Enter}");
  expect(screen.getByRole("button", { name: /April 16th, 2026, selected/ })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /previous month/i }));
  expect(screen.getByText("March 2026")).toBeInTheDocument();
});

it("selects a complete date range", async () => {
  const user = userEvent.setup();
  render(<DateRangeExample />);
  await user.click(screen.getByRole("button", { name: /April 15th, 2026/ }));
  await user.click(screen.getByRole("button", { name: /April 17th, 2026/ }));
  expect(screen.getAllByRole("gridcell", { selected: true })).toHaveLength(3);
});
