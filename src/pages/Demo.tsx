import { useMemo, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle, Linkedin, Mail } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { MonoLogo } from "@/components/ui/MonoLogo";
import { buildLocalizedPath } from "@i18n/routing";
import { useLanguage } from "@/providers/LanguageProvider";
import { STANDARD_DATASET_LOGOS } from "@/constants/datasets";

const Demo = () => {
  const { language } = useLanguage();
  const { t: tPages } = useTranslation("pages", { keyPrefix: "demo" });
  const { t: tCommon } = useTranslation("common", { keyPrefix: "actions" });
  const location = useLocation();
  const [showTrialMessage, setShowTrialMessage] = useState(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    if (urlParams.get("reason") === "trial_expired") {
      setShowTrialMessage(true);
    }
  }, [location]);

  const partnerLogos = useMemo(() => STANDARD_DATASET_LOGOS.slice(0, 14), []);
  
  const usps = useMemo(() => {
    const result = tPages("usps", undefined, { returnObjects: true });
    return Array.isArray(result) ? result : [];
  }, [tPages]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="bg-background border-b border-border sticky top-0 z-50 overflow-x-clip">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="shrink sm:shrink-0">
              <Link to={buildLocalizedPath("/", language)}>
                <img src="/assets/logo-ecodex-navbar.png" alt="Ecodex" className="h-10 sm:h-12 md:h-16 w-auto" />
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Link to={buildLocalizedPath("/signup", language)}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm tracking-normal px-3"
                >
                  {tCommon("sign_up")}
                </Button>
              </Link>
              <Link to={buildLocalizedPath("/login", language)}>
                <Button size="sm" className="text-xs sm:text-sm tracking-normal px-3">
                  {tCommon("log_in")}
                </Button>
              </Link>
              <div className="ml-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <section className="flex-1 py-14 sm:py-20 px-4">
        <div className="container mx-auto">
          {/* Trial Expired Message */}
          {showTrialMessage && (
            <Alert className="mb-8 max-w-4xl mx-auto">
              <AlertDescription className="text-center">
                <p className="font-semibold">{tPages("trialExpired.title")}</p>
                <p className="mt-2">{tPages("trialExpired.description")}</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid lg:grid-cols-2 gap-12 items-start max-w-7xl mx-auto">
            {/* Left Column */}
            <div className="space-y-8 py-4">
              <div className="space-y-4">
                <h1 className="text-3xl md:text-4xl font-bold leading-tight">
                  {tPages("title")}
                </h1>
                <p className="text-lg text-muted-foreground">
                  {tPages("subtitle")}
                </p>
              </div>

              {/* USPs */}
              <div className="space-y-4">
                {usps.map((usp: string, index: number) => (
                  <div key={index} className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-base">{usp}</span>
                  </div>
                ))}
              </div>

              {/* Logos Section */}
              <div className="space-y-6 pt-6">
                <h4 className="font-bold text-center">
                  {tPages("logosTitle")}
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-6 sm:gap-8 items-center">
                  {partnerLogos.map((logo) => (
                    <div key={logo.name} className="flex flex-col items-center">
                      <MonoLogo src={logo.src} alt={logo.name} className="max-h-[50px] w-full h-[50px]" />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Formbricks Embed */}
            <div className="lg:sticky lg:top-24">
              <div style={{ position: "relative", height: "80dvh", overflow: "auto" }}> 
                <iframe 
                  src="https://app.formbricks.com/s/cmh0d4dh50yobad019gak8a76" 
                  frameBorder="0" 
                  style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", border: 0 }}>
                </iframe>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center space-y-8">
            <img src="/assets/logo-ecodex-footer.png" alt="Ecodex" className="h-12" />
            <p className="text-white max-w-md">{tPages("footer.tagline")}</p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="sm" className="p-2 text-white hover:text-white hover:bg-white/10">
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 text-white hover:text-white hover:bg-white/10">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 w-full pt-8 border-t border-white/20">
              <div className="text-white text-sm">{tPages("footer.copyright")}</div>
              <div className="flex space-x-6 text-sm text-white">
                <Link to={buildLocalizedPath("/privacy", language)} className="hover:text-white transition-colors">
                  {tPages("footer.legal.privacy")}
                </Link>
                <Link to={buildLocalizedPath("/terms", language)} className="hover:text-white transition-colors">
                  {tPages("footer.legal.terms")}
                </Link>
                <Link to={buildLocalizedPath("/cookies", language)} className="hover:text-white transition-colors">
                  {tPages("footer.legal.cookies")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Demo;

