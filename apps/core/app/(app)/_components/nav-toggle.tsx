"use client";

// Small-screen navigation state (docs/design/navigation.md, Shell
// Anatomy: "the sidebar collapses behind a menu button"). The state is a
// visually hidden checkbox so the sidebar and backdrop react through CSS
// (`peer-checked:`) without the server layout becoming a client
// component. Desktop (lg+) ignores it entirely.
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

export const NAV_TOGGLE_ID = "app-nav-toggle";

function setOpen(open: boolean) {
  const box = document.getElementById(NAV_TOGGLE_ID);
  if (box instanceof HTMLInputElement) box.checked = open;
}

// Rendered first inside the shell so the sidebar and backdrop that follow
// it are its `peer`s.
export function NavToggleState() {
  const pathname = usePathname();
  // Navigating closes the drawer; Escape closes it too.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <input
      id={NAV_TOGGLE_ID}
      type="checkbox"
      tabIndex={-1}
      aria-hidden="true"
      className="peer sr-only"
    />
  );
}

export function NavBackdrop() {
  return (
    <div
      aria-hidden="true"
      onClick={() => setOpen(false)}
      className="fixed inset-0 z-30 hidden bg-foreground/40 peer-checked:block lg:!hidden print:hidden"
    />
  );
}

export function NavMenuButton() {
  return (
    <button
      type="button"
      aria-label="Open navigation"
      onClick={() => setOpen(true)}
      className="-ml-2 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:hidden"
    >
      <Menu aria-hidden="true" className="size-5" />
    </button>
  );
}
