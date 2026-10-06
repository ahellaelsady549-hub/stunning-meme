import { Link } from "@tanstack/react-router";
import { Megaphone } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Props = {
  /** visual size of the slot */
  variant?: "banner" | "inline" | "sidebar";
  className?: string;
};

/**
 * Reusable advertising placeholder. Renders a bordered, branded slot that
 * can later be swapped for real ad creatives.
 */
export function AdSlot({ variant = "banner", className = "" }: Props) {
  const { t } = useI18n();

  const height =
    variant === "banner"
      ? "min-h-24 sm:min-h-28"
      : variant === "sidebar"
        ? "min-h-56"
        : "min-h-20";

  return (
    <Link
      to="/contact"
      className={`group relative flex ${height} w-full items-center justify-center overflow-hidden rounded-xl border border-dashed bg-muted/40 px-4 py-4 text-center transition-colors hover:bg-muted/70 ${className}`}
      aria-label={t("ad_space")}
    >
      <span className="absolute top-2 start-2 rounded-md bg-background/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t("ad_sponsored")}
      </span>
      <span className="flex flex-col items-center gap-1.5">
        <Megaphone className="h-5 w-5 text-muted-foreground transition-transform group-hover:scale-110" />
        <span className="text-sm font-semibold text-foreground">{t("ad_space")}</span>
        <span className="text-xs text-muted-foreground">{t("ad_contact_us")}</span>
      </span>
    </Link>
  );
}
