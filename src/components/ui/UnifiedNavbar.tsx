import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useQuotas } from "@/hooks/useQuotas";
import { useEmissionFactorAccess } from "@/hooks/useEmissionFactorAccess";
import { NavbarQuotaWidget } from "@/components/ui/NavbarQuotaWidget";
import { Lock } from "lucide-react";
import { useLanguage } from "@/providers/LanguageProvider";
import { buildLocalizedPath } from "@i18n/routing";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

export const UnifiedNavbar = () => {
  const { t } = useTranslation(["navbar", "common"]);
  const { language } = useLanguage();
  const { user, signOut } = useAuth();
  const { canUseFavorites } = useEmissionFactorAccess();
  const { canImportData } = usePermissions();
  const { quotaData, isLoading, isAtLimit } = useQuotas();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate(buildLocalizedPath("/", language));
  };

  const redirectWithLang = (path: string) => {
    navigate(buildLocalizedPath(path, language), { replace: false });
  };

  return (
    <nav className="border-b border-border bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to={buildLocalizedPath(user ? "/search" : "/", language)} className="flex items-center gap-2">
            <img src="/assets/logo-ecodex-navbar.png" alt="Ecodex" className="h-10" />
          </Link>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden md:block">
                  <NavbarQuotaWidget quotaData={quotaData} isLoading={isLoading} isAtLimit={isAtLimit} />
                </div>

                <Link to={buildLocalizedPath("/search", language)}>
                  <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                    {t("navbar:search")}
                  </Button>
                </Link>

                {canUseFavorites() ? (
                  <Link to={buildLocalizedPath("/favoris", language)}>
                    <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                      {t("navbar:favorites")}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-foreground opacity-50 cursor-not-allowed"
                    disabled
                    title={t("navbar:favorites_locked") ?? undefined}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {t("navbar:favorites")}
                  </Button>
                )}

                {canImportData ? (
                  <Link to={buildLocalizedPath("/import", language)}>
                    <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                      {t("navbar:import")}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    variant="ghost"
                    className="text-foreground opacity-50 cursor-not-allowed"
                    disabled
                    title={t("navbar:import_locked") ?? undefined}
                  >
                    <Lock className="h-4 w-4 mr-2" />
                    {t("navbar:import")}
                  </Button>
                )}

                <Link to={buildLocalizedPath("/settings", language)}>
                  <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                    {t("navbar:settings")}
                  </Button>
                </Link>

                <Button
                  onClick={handleSignOut}
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                >
                  {t("navbar:logout")}
                </Button>
              </>
            ) : (
              <>
                <Link to={buildLocalizedPath("/signup", language)}>
                  <Button variant="ghost" className="text-foreground hover:bg-primary/10 hover:text-primary">
                    {t("common:actions.sign_up")}
                  </Button>
                </Link>
                <Link to={buildLocalizedPath("/login", language)}>
                  <Button>{t("common:actions.log_in")}</Button>
                </Link>
              </>
            )}

            <LanguageSwitcher align="end" />
          </div>
        </div>
      </div>
    </nav>
  );
};