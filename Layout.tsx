import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Box, Package, QrCode, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { useTranslation } from "./Components/i18n/translations.tsx";

interface LayoutProps {
  children: React.ReactNode;
  currentPageName: string;
}

export default function Layout({ children, currentPageName }: LayoutProps) {
  const { t } = useTranslation();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const navItems = [
    { name: "Samples", page: "Samples", icon: Box },
    { name: "Bundles", page: "Bundles", icon: Package },
    { name: "Checkout", page: "Checkout", icon: QrCode },
  ];

  const isActive = (page: string) => {
    if (page === "Samples") {
      return ["Samples", "SampleDetails", "SampleCreate", "SampleEdit"].includes(currentPageName);
    }
    if (page === "Bundles") {
      return ["Bundles", "BundleDetails", "BundleCreate", "BundleEdit"].includes(currentPageName);
    }
    return currentPageName === page;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to={createPageUrl("Samples")} className="flex items-center gap-3">
              <img
                src="https://assets.codepen.io/11817390/lifepreneur-logo.jpg"
                alt="Lifepreneur"
                className="h-10 w-auto rounded-lg"
              />
              <span className="font-bold text-xl text-slate-900 hidden sm:block">
                {t("nav.inventory")}
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.page);
                return (
                  <Link key={item.page} to={createPageUrl(item.page)}>
                    <Button
                      variant={active ? "secondary" : "ghost"}
                      className={`
                        gap-2 px-4
                        ${active
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 hover:text-slate-900"
                        }
                      `}
                    >
                      <Icon className="w-4 h-4" />
                      {t(`nav.${item.name.toLowerCase()}`)}
                    </Button>
                  </Link>
                );
              })}
            </div>

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.page);
                return (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div
                      className={`
                        flex items-center gap-3 px-4 py-3 rounded-lg
                        ${active
                          ? "bg-slate-100 text-slate-900"
                          : "text-slate-600 hover:bg-slate-50"
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                      {t(`nav.${item.name.toLowerCase()}`)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Page Content */}
      <main>
        {children}
      </main>
    </div>
  );
}

