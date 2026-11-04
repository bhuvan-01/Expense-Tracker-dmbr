import React from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/manrope/latin-500.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/source-sans-3/latin-400.css";
import "@fontsource/source-sans-3/latin-500.css";
import "@fontsource/source-sans-3/latin-600.css";
import { AuthPage } from "./pages/AuthPage";
import { WorkspacePage } from "./pages/WorkspacePage";
import "./styles.css";

const path = window.location.pathname;
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <a className="skip-link" href="#main-content">
      Skip to content
    </a>
    {path === "/app" ? (
      <WorkspacePage />
    ) : path === "/sign-in" || path === "/" ? (
      <AuthPage signup={false} />
    ) : path === "/sign-up" ? (
      <AuthPage signup />
    ) : (
      <main id="main-content" className="not-found">
        <h1>Page not found</h1>
        <a href="/sign-in">Go to sign in</a>
      </main>
    )}
  </React.StrictMode>,
);
