import { DayPicker } from "@daypicker/react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import * as React from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  components,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  const navigationButton = cn(
    buttonVariants({ variant: "outline" }),
    "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100 pointer-events-auto"
  );

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("relative w-fit p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex h-7 justify-center px-8 items-center",
        caption_label: "text-sm font-medium",
        nav: "absolute inset-x-3 top-3 flex justify-between items-center pointer-events-none",
        button_previous: navigationButton,
        button_next: navigationButton,
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
        week: "flex w-full mt-2",
        day: "h-9 w-9 text-center text-sm p-0 relative focus-within:z-20",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),
        range_start: "rounded-l-md bg-accent",
        range_end: "rounded-r-md bg-accent",
        selected:
          "[&:not(.range-middle)>button]:bg-primary [&:not(.range-middle)>button]:text-primary-foreground [&:not(.range-middle)>button]:hover:bg-primary [&:not(.range-middle)>button]:hover:text-primary-foreground",
        today:
          "[&:not([aria-selected])>button]:bg-accent [&:not([aria-selected])>button]:text-accent-foreground",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        range_middle:
          "range-middle bg-accent text-accent-foreground [&>button]:rounded-none [&>button]:bg-accent [&>button]:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation = "down", className, size = 16 }) => {
          const Icon = {
            left: ChevronLeft,
            right: ChevronRight,
            up: ChevronUp,
            down: ChevronDown,
          }[orientation];
          return <Icon className={cn("h-4 w-4", className)} size={size} aria-hidden />;
        },
        ...components,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
