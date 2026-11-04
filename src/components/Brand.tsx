import { ChartNoAxesColumnIncreasing } from "lucide-react";

export function Brand() {
  return (
    <span className="brand">
      <span className="brand-icon">
        <ChartNoAxesColumnIncreasing
          size={22}
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </span>
      <span>
        Expense Tracker<span className="brand-dot">.</span>
      </span>
    </span>
  );
}
