import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ThemeToggle } from "./ThemeToggle";
import { FileText, LayoutGrid, Sparkles, Home, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [loc] = useLocation();
  const [open, setOpen] = useState(false);
  const isBuilder = loc.startsWith("/builder") || loc.startsWith("/preview");
  if (isBuilder) return <>{children}</>;
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold tracking-tight text-lg">
            <span className="relative inline-flex size-8 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="size-4" />
            </span>
            <span>
              job<span className="text-primary">X</span>
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            <NavLink href="/" active={loc === "/"} icon={<Home className="size-3.5" />}>
              Home
            </NavLink>
            <NavLink href="/dashboard" active={loc.startsWith("/dashboard")} icon={<FileText className="size-3.5" />}>
              My Resumes
            </NavLink>
            <NavLink href="/templates" active={loc.startsWith("/templates")} icon={<LayoutGrid className="size-3.5" />}>
              Templates
            </NavLink>
            <ThemeToggle />
          </nav>

          {/* Mobile Navigation Trigger */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-6 flex flex-col gap-6">
                <SheetHeader className="text-left">
                  <SheetTitle className="flex items-center gap-2 font-bold tracking-tight text-lg">
                    <span className="relative inline-flex size-8 rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground items-center justify-center shadow-lg shadow-primary/20">
                      <Sparkles className="size-4" />
                    </span>
                    <span>
                      job<span className="text-primary">X</span>
                    </span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-3 mt-4">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition hover:bg-muted ${
                      loc === "/" ? "bg-accent/10 text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <Home className="size-5" />
                    Home
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition hover:bg-muted ${
                      loc.startsWith("/dashboard") ? "bg-accent/10 text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <FileText className="size-5" />
                    My Resumes
                  </Link>
                  <Link
                    href="/templates"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium transition hover:bg-muted ${
                      loc.startsWith("/templates") ? "bg-accent/10 text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    <LayoutGrid className="size-5" />
                    Templates
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex size-5 rounded-md bg-gradient-to-br from-primary to-accent" />
            <span>
              <span className="font-semibold text-foreground">
                job<span className="text-primary">X</span>
              </span>{" "}
              · AI Resume Builder
            </span>
          </div>
          <div>© {new Date().getFullYear()} jobX · Built with AI for job seekers.</div>
        </div>
      </footer>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
  icon,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-md text-sm hover-elevate ${
        active ? "bg-accent/10 text-foreground" : "text-muted-foreground"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {children}
      </span>
    </Link>
  );
}
