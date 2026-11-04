import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Check,
  LockKeyhole,
  ShoppingBasket,
  TrainFront,
  Utensils,
} from "lucide-react";
import { Brand } from "./Brand";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-layout">
      <aside className="story-panel" aria-label="About Expense Tracker">
        <Brand />
        <div className="story-content">
          <p className="eyebrow">
            <span className="small-line" /> YOUR EVERYDAY, IN VIEW
          </p>
          <h2>
            A little clarity.
            <br />
            <span>A lot more calm.</span>
          </h2>
          <p className="story-description">
            Make sense of the small things.
            <br />
            Make space for what matters.
          </p>
          <div
            className="ledger-preview"
            aria-label="Illustrative preview of a future spending overview"
          >
            <div className="preview-top">
              <span>THE MONTH AT A GLANCE</span>
              <span className="sample-label">Sample preview</span>
            </div>
            <div className="preview-total">
              <span>
                Monthly spending
                <strong>
                  £1,240<span>.00</span>
                </strong>
              </span>
              <span className="preview-chart">
                <ArrowUpRight size={20} aria-hidden="true" />
              </span>
            </div>
            <div className="budget-ruler" aria-hidden="true">
              <span />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <div className="preview-caption">
              <span>62% of monthly budget</span>
              <span>£760 remaining</span>
            </div>
            <div className="preview-divider" />
            <div className="preview-row">
              <span className="category-icon groceries">
                <ShoppingBasket size={17} aria-hidden="true" />
              </span>
              <span>
                Groceries<small>The everyday essentials</small>
              </span>
              <strong>£320.00</strong>
            </div>
            <div className="preview-row">
              <span className="category-icon transport">
                <TrainFront size={17} aria-hidden="true" />
              </span>
              <span>
                Transport<small>Places to be</small>
              </span>
              <strong>£180.00</strong>
            </div>
            <div className="preview-row">
              <span className="category-icon dining">
                <Utensils size={17} aria-hidden="true" />
              </span>
              <span>
                Eating out<small>Good food, good company</small>
              </span>
              <strong>£145.00</strong>
            </div>
          </div>
          <p className="preview-note">
            <Check size={14} aria-hidden="true" /> A glimpse of the tracker
            we're building.
          </p>
        </div>
        <p className="story-footer">
          <LockKeyhole size={15} aria-hidden="true" /> A private space for your
          financial everyday.
        </p>
      </aside>
      <main className="auth-main" id="main-content">
        <div className="mobile-brand">
          <Brand />
        </div>
        {children}
        <p className="auth-footer">A small habit. A clearer picture.</p>
      </main>
    </div>
  );
}
