import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { AlertCircle } from "lucide-react";

export const metadata = {
  title: "Design System — Postable",
};

const COLOR_PALETTE = [
  { name: "--postable-black", hex: "#0A0A0A", label: "Black" },
  { name: "--postable-white", hex: "#FFFFFF", label: "White", border: true },
  { name: "--postable-secondary", hex: "#6B6B6B", label: "Secondary" },
  { name: "--postable-muted", hex: "#B0B0B0", label: "Muted" },
  { name: "--postable-border", hex: "#E0E0E0", label: "Border" },
  { name: "--postable-surface", hex: "#F5F5F5", label: "Surface" },
];

const DARK_PALETTE = [
  { name: "background", hex: "#0A0A0A", label: "Background" },
  { name: "foreground", hex: "#FFFFFF", label: "Foreground", border: true },
  { name: "card", hex: "#121212", label: "Card" },
  { name: "secondary", hex: "#1E1E1E", label: "Secondary" },
  { name: "muted-foreground", hex: "#B0B0B0", label: "Muted Fg" },
  { name: "border-dark", hex: "#282828", label: "Border" },
];

const TYPE_SCALE = [
  { label: "4xl", classes: "text-4xl font-bold", sample: "Heading Display", font: "DM Sans", size: "36px / 700" },
  { label: "3xl", classes: "text-3xl font-bold", sample: "Heading Large", font: "DM Sans", size: "30px / 700" },
  { label: "2xl", classes: "text-2xl font-bold", sample: "Heading Medium", font: "DM Sans", size: "24px / 700" },
  { label: "xl", classes: "text-xl font-semibold", sample: "Heading Small", font: "DM Sans", size: "20px / 600" },
  { label: "lg", classes: "text-lg", sample: "Body Large — Inter regular body text that reads comfortably.", font: "Inter", size: "18px / 400" },
  { label: "base", classes: "text-base", sample: "Body Base — The default paragraph size for all content.", font: "Inter", size: "16px / 400" },
  { label: "sm", classes: "text-sm", sample: "Body Small — Used for labels, captions, and metadata.", font: "Inter", size: "14px / 400" },
  { label: "xs", classes: "text-xs text-muted-foreground", sample: "Caption — Smallest readable size, muted gray.", font: "Inter", size: "12px / 400" },
];

const SPACING = [
  { label: "1", px: "4px", width: "w-1" },
  { label: "2", px: "8px", width: "w-2" },
  { label: "3", px: "12px", width: "w-3" },
  { label: "4", px: "16px", width: "w-4" },
  { label: "6", px: "24px", width: "w-6" },
  { label: "8", px: "32px", width: "w-8" },
  { label: "10", px: "40px", width: "w-10" },
  { label: "12", px: "48px", width: "w-12" },
  { label: "16", px: "64px", width: "w-16" },
];

export default function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border px-8 py-12">
        <h1 className="text-4xl font-bold tracking-tight" style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
          Postable Design System
        </h1>
        <p className="mt-2 text-muted-foreground" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
          Monochrome editorial identity — DM Sans + Inter, strict black and white.
        </p>
      </div>

      <div className="px-8 py-12 space-y-20 max-w-5xl">

        {/* 1. Color Palette */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Color Palette</h2>
          <p className="text-sm text-muted-foreground mb-6">Light mode tokens</p>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {COLOR_PALETTE.map(({ name, hex, label, border }) => (
              <div key={name} className="space-y-2">
                <div
                  className={`h-16 rounded-md ${border ? "border border-border" : ""}`}
                  style={{ background: hex }}
                />
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground font-mono">{hex}</p>
                <p className="text-xs text-muted-foreground font-mono leading-tight">{name}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground mt-8 mb-6">Dark mode tokens</p>
          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {DARK_PALETTE.map(({ name, hex, label, border }) => (
              <div key={name} className="space-y-2">
                <div
                  className={`h-16 rounded-md ${border ? "border border-border" : ""}`}
                  style={{ background: hex }}
                />
                <p className="text-xs font-medium">{label}</p>
                <p className="text-xs text-muted-foreground font-mono">{hex}</p>
                <p className="text-xs text-muted-foreground font-mono leading-tight">{name}</p>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* 2. Typography Scale */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Typography Scale</h2>
          <p className="text-sm text-muted-foreground mb-8">DM Sans for headings, Inter for body text.</p>
          <div className="space-y-8">
            {TYPE_SCALE.map(({ label, classes, sample, font, size }) => (
              <div key={label} className="flex items-baseline gap-6">
                <div className="w-12 text-xs text-muted-foreground font-mono shrink-0">{label}</div>
                <div className="flex-1">
                  <p
                    className={classes}
                    style={{
                      fontFamily: font === "DM Sans"
                        ? "var(--font-sans), system-ui, sans-serif"
                        : "var(--font-body), system-ui, sans-serif",
                    }}
                  >
                    {sample}
                  </p>
                </div>
                <div className="text-xs text-muted-foreground font-mono shrink-0 text-right">
                  <div>{font}</div>
                  <div>{size}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* 3. Spacing System */}
        <section>
          <h2 className="text-2xl font-bold mb-2">Spacing System</h2>
          <p className="text-sm text-muted-foreground mb-8">Tailwind spacing tokens at 4px base unit.</p>
          <div className="space-y-4">
            {SPACING.map(({ label, px, width }) => (
              <div key={label} className="flex items-center gap-4">
                <div className="w-8 text-xs text-muted-foreground font-mono shrink-0">{label}</div>
                <div className={`${width} h-4 bg-foreground rounded-sm shrink-0`} />
                <div className="text-xs text-muted-foreground font-mono">{px}</div>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* 4. Component Gallery */}
        <section>
          <h2 className="text-2xl font-bold mb-8">Component Gallery</h2>

          {/* Buttons */}
          <div className="space-y-4 mb-12">
            <h3 className="text-lg font-semibold">Buttons</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <Button>Primary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
              <Button disabled>Disabled</Button>
              <Button disabled>
                <span className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                Loading
              </Button>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              <Button size="sm">Small</Button>
              <Button size="default">Default</Button>
              <Button size="lg">Large</Button>
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4 mb-12">
            <h3 className="text-lg font-semibold">Inputs</h3>
            <div className="max-w-sm space-y-4">
              <div className="space-y-1">
                <Label htmlFor="demo-email">Email</Label>
                <Input id="demo-email" type="email" placeholder="you@postable.com" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="demo-error">Email (error state)</Label>
                <Input
                  id="demo-error"
                  type="email"
                  placeholder="you@postable.com"
                  className="border-destructive focus-visible:ring-destructive"
                />
                <p className="text-sm text-destructive">Email inválido</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="demo-disabled">Disabled</Label>
                <Input id="demo-disabled" type="text" placeholder="Not editable" disabled />
              </div>
            </div>
          </div>

          {/* Cards */}
          <div className="space-y-4 mb-12">
            <h3 className="text-lg font-semibold">Cards</h3>
            <div className="max-w-sm">
              <Card>
                <CardHeader>
                  <CardTitle>Brand Setup</CardTitle>
                  <CardDescription>Configure your brand identity and content preferences.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Card content area for displaying structured information or form fields.
                  </p>
                </CardContent>
                <CardFooter className="flex gap-2">
                  <Button variant="outline" size="sm">Cancel</Button>
                  <Button size="sm">Save</Button>
                </CardFooter>
              </Card>
            </div>
          </div>

          {/* Navigation */}
          <div className="space-y-4 mb-12">
            <h3 className="text-lg font-semibold">Navigation</h3>
            <nav className="flex gap-1 border-b border-border">
              <Button
                variant="ghost"
                className="rounded-none border-b-2 border-foreground"
              >
                Overview
              </Button>
              <Button variant="ghost" className="rounded-none border-b-2 border-transparent">
                Content
              </Button>
              <Button variant="ghost" className="rounded-none border-b-2 border-transparent">
                Analytics
              </Button>
              <Button variant="ghost" className="rounded-none border-b-2 border-transparent">
                Settings
              </Button>
            </nav>
          </div>

          {/* Badges */}
          <div className="space-y-4 mb-12">
            <h3 className="text-lg font-semibold">Badges</h3>
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-4 mb-12">
            <h3 className="text-lg font-semibold">Progress</h3>
            <div className="max-w-sm space-y-3">
              <Progress value={25} />
              <Progress value={50} />
              <Progress value={75} />
              <Progress value={100} />
            </div>
          </div>

          {/* Alerts */}
          <div className="space-y-4 mb-12">
            <h3 className="text-lg font-semibold">Alerts</h3>
            <div className="max-w-lg space-y-3">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>
                  This is a default alert for general information.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>
                  Erro ao criar marca. Verifique os dados e tente novamente.
                </AlertDescription>
              </Alert>
            </div>
          </div>

          {/* Separator */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Separator</h3>
            <div className="max-w-sm space-y-3">
              <Separator />
              <div className="flex items-center gap-4">
                <Separator className="flex-1" />
                <span className="text-xs text-muted-foreground">ou</span>
                <Separator className="flex-1" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
