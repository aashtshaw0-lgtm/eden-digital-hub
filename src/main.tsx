import '@vly-ai/integrations';
import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "./convex/_generated/api";
import React, { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation } from "react-router";
import { CartProvider } from "./context/CartProvider";
import { SettingsProvider } from "./context/SettingsProvider";
import { RequireAdmin } from "./components/eden/RequireAdmin";
import "./index.css";

// Global chrome mounts on every page but is only interacted with after first
// paint, so it is split out of the critical bundle and rendered behind its own
// Suspense boundary — a slow chunk can never delay the route content.
const DynamicIsland = lazy(() =>
  import("./components/eden/DynamicIsland").then((m) => ({ default: m.DynamicIsland })),
);
const ChatWidget = lazy(() =>
  import("./components/eden/ChatWidget").then((m) => ({ default: m.ChatWidget })),
);
const CookieConsent = lazy(() =>
  import("./components/eden/CookieConsent").then((m) => ({ default: m.CookieConsent })),
);

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Portal = lazy(() => import("./pages/Portal.tsx"));
const Services = lazy(() => import("./pages/Services.tsx"));
const Checkout = lazy(() => import("./pages/Checkout.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const Legal = lazy(() => import("./pages/Legal.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Credits = lazy(() => import("./pages/Credits.tsx"));
const Products = lazy(() => import("./pages/Products.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

let seededThisSession = false;

/** Runs the idempotent catalog seed once per browser session. */
function SeedOnce() {
  const seed = useMutation(api.catalog.seedIfEmpty);
  useEffect(() => {
    if (seededThisSession) return;
    seededThisSession = true;
    void seed();
  }, [seed]);
  return null;
}

/** Persistent global UI: Dynamic Island + hybrid chat, everywhere except /auth. */
function GlobalChrome() {
  const location = useLocation();
  const onAuth = location.pathname === "/auth";
  return (
    <>
      {!onAuth && (
        <Suspense fallback={null}>
          <DynamicIsland />
          <ChatWidget />
          <CookieConsent />
        </Suspense>
      )}
    </>
  );
}

/** Silent error boundary — if VlyToolbar crashes it renders nothing instead of
 *  crashing the whole app (e.g. hook errors in the browser runtime). */
class ToolbarErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: Error) {
    console.warn("[VlyToolbar] Caught error, toolbar disabled:", err.message);
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/** Hard guard so runtime errors never leave the preview as a blank page. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[Preview] Root crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">Preview runtime error</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            {this.state.stack && (
              <pre className="mt-3 text-left text-[10px] leading-4 text-muted-foreground/80 max-h-40 overflow-auto rounded border border-border/60 p-2">
                {this.state.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);



function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}


createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ToolbarErrorBoundary>
        <VlyToolbar />
      </ToolbarErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <SettingsProvider>
          <CartProvider>
            <BrowserRouter>
              <SeedOnce />
              <RouteSyncer />
              <GlobalChrome />
              <Suspense fallback={<RouteLoading />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/services" element={<Services />} />
                  <Route
                    path="/checkout"
                    element={
                      <RequireAuth
                        title="Sign in to check out"
                        description="Your cart and order history are tied to your account."
                      >
                        <Checkout />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/auth"
                    element={<AuthPage redirectAfterAuth="/portal" />}
                  />
                  <Route path="/legal" element={<Legal />} />
                  <Route path="/credits" element={<Credits />} />
                  <Route path="/products" element={<Products />} />
                  <Route
                    path="/portal"
                    element={
                      <RequireAuth>
                        <Portal />
                      </RequireAuth>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <RequireAdmin>
                        <Admin />
                      </RequireAdmin>
                    }
                  />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
            <Toaster />
          </CartProvider>
        </SettingsProvider>
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
