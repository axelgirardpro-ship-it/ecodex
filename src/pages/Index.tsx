import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { t as translate } from "i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Linkedin, Mail } from "lucide-react";
import { MonoLogo } from "@/components/ui/MonoLogo";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/providers/LanguageProvider";
import { buildLocalizedPath } from "@i18n/routing";
import { STANDARD_DATASET_LOGOS, PREMIUM_DATASET_LOGOS } from "@/constants/datasets";

type IndexHighlight = {
  title: string;
  description: string;
};

type IndexTab = {
  id: string;
  label: string;
  title: string;
  imageAlt: string;
  highlights: IndexHighlight[];
};

type PricingPlan = {
  name: string;
  startingFrom: string;
  price: string;
  priceUnit: string;
  description: string;
  features: string[];
  cta: string;
};

const TAB_IMAGES: Record<string, string> = {
  data: "/assets/onglet-donnees.png",
  search: "/assets/onglet-recherche.png",
  custom: "/assets/onglet-personnalisation.png"
};


const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const { language, setLanguage } = useLanguage();
  const { t: tPages } = useTranslation("pages", { keyPrefix: "index" });

  const heroLines = useMemo(
    () => (tPages("hero.lines", undefined, { returnObjects: true }) as string[]) ?? [],
    [tPages]
  );
  const tabs = useMemo(() => {
    const result = tPages("tabsSection.items", undefined, { returnObjects: true });
    return Array.isArray(result) ? (result as IndexTab[]) : [];
  }, [tPages]);

  const datasetTabs = useMemo(() => {
    const result = tPages("datasetsSection.tabs", undefined, { returnObjects: true });
    return Array.isArray(result) ? (result as { id: string; label: string }[]) : [];
  }, [tPages]);

  const expertBlocks = useMemo(() => {
    const result = tPages("expertSection.blocks", undefined, { returnObjects: true });
    return Array.isArray(result) ? (result as IndexHighlight[]) : [];
  }, [tPages]);

  const pricingPlans = useMemo(() => {
    const result = tPages("pricing.plans", undefined, { returnObjects: true });
    return (result as Record<string, PricingPlan>) ?? {};
  }, [tPages]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const accessToken = urlParams.get("access_token") || hashParams.get("access_token");
    const type = urlParams.get("type") || hashParams.get("type");

    if (accessToken && (type === "signup" || type === "invite")) {
      navigate(
        buildLocalizedPath("/auth/callback", language) + window.location.search + window.location.hash
      );
      return;
    }

    if (user?.user_metadata?.workspace_id && user?.user_metadata?.invitation_type === "workspace") {
      navigate(buildLocalizedPath("/auth/callback", language));
    }
  }, [navigate, user, language]);

  // Note: La détection de langue est gérée par LanguageLayout dans App.tsx
  // Pas besoin de dupliquer la logique ici

  const partnerLogos = useMemo(() => STANDARD_DATASET_LOGOS.slice(0, 14), []);

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-background border-b border-border sticky top-0 z-50 overflow-x-clip">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="shrink sm:shrink-0">
              <img src="/assets/logo-ecodex-navbar.png" alt="Ecodex" className="h-10 sm:h-12 md:h-16 w-auto" />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Link to={buildLocalizedPath("/signup", language)}>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs sm:text-sm tracking-normal px-3"
                >
                  {translate("common:actions.sign_up")}
                </Button>
              </Link>
              <Link to={buildLocalizedPath("/login", language)}>
                <Button size="sm" className="text-xs sm:text-sm tracking-normal px-3">
                  {translate("common:actions.log_in")}
                </Button>
              </Link>
              <div className="ml-2">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </div>
      </nav>

      <section className="py-14 sm:py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6 order-2 lg:order-1">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight md:leading-[1.1] text-primary-foreground">
                {heroLines.map((line, index) => (
                  <span key={line} className="block">
                    {line}
                    {index !== heroLines.length - 1 && <br />}
                  </span>
                ))}
              </h1>
              <p className="text-primary-foreground/90 text-base sm:text-lg max-w-prose">
                {tPages("hero.subtitle")}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to={buildLocalizedPath("/signup", language)}>
                  <Button
                    variant="hero"
                    size="sm"
                    className="w-full sm:w-auto text-xs sm:text-sm md:text-base normal-case tracking-normal whitespace-normal text-center px-4 sm:px-6 min-h-[44px]"
                  >
                    {tPages("hero.primaryCta")}
                  </Button>
                </Link>
                <Link to={buildLocalizedPath("/demo", language)}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10 text-xs sm:text-sm md:text-base normal-case tracking-normal whitespace-normal text-center px-4 sm:px-6 min-h-[44px]"
                  >
                    {tPages("hero.bookDemo")}
                  </Button>
                </Link>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <img
                src="/assets/header-homepage.png"
                alt={tPages("hero.imageAlt")}
                className="w-full h-auto rounded-lg"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 bg-background">
        <div className="container mx-auto px-4 text-center">
          <h4 className="font-bold mb-8 sm:mb-12">{tPages("navbar.partners")}</h4>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-6 sm:gap-8 items-center">
            {partnerLogos.map((logo) => (
              <div key={logo.name} className="flex flex-col items-center">
                <MonoLogo src={logo.src} alt={logo.name} className="max-h-[50px] w-full h-[50px]" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight md:leading-[1.1] mb-6 sm:mb-8">
            {tPages("demo.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-10">
            {tPages("demo.subtitle")}
          </p>
          <div className="max-w-4xl mx-auto">
            <div
              style={{ position: "relative", paddingBottom: "calc(52.44791666666667% + 41px)", height: 0, width: "100%" }}
            >
              <iframe
                src="https://demo.arcade.software/rg5Pizw2AGo4sO73KGPN?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true"
                title={tPages("demo.title")}
                frameBorder="0"
                loading="lazy"
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", colorScheme: "light" }}
                allow="clipboard-write"
                className="rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4 bg-background">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold leading-tight md:leading-[1.1] text-center mb-10 sm:mb-12">
            {tPages("tabsSection.title")}
          </h2>
          <Tabs defaultValue={tabs[0]?.id ?? "data"} className="max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-12 rounded-full items-center h-auto py-2">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="rounded-full w-full text-sm sm:text-base">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.id} value={tab.id} className="mt-6 sm:mt-8 grid lg:grid-cols-2 gap-12 items-start">
                <div className="space-y-8 py-4">
                  <h3 className="text-3xl font-bold leading-tight">{tab.title}</h3>
                  <div className="space-y-8">
                    {tab.highlights.map((highlight) => (
                      <div key={highlight.title}>
                        <h4 className="text-lg font-semibold mb-2">{highlight.title}</h4>
                        <p className="text-base font-light leading-relaxed">{highlight.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <img src={TAB_IMAGES[tab.id]} alt={tab.imageAlt} className="w-full h-auto" />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight md:leading-[1.1] text-center mb-8 sm:mb-12">
            {tPages("datasetsSection.title")}
          </h2>
          <Tabs defaultValue={datasetTabs[0]?.id ?? "free"} className="max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 mb-12 rounded-full items-center h-auto py-2">
              {datasetTabs.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="rounded-full w-full text-sm sm:text-base">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="free" className="mt-6 sm:mt-8">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-6 sm:gap-8">
                {STANDARD_DATASET_LOGOS.map((logo) => (
                  <div key={logo.name} className="flex flex-col items-center space-y-2">
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center">
                      <MonoLogo src={logo.src} alt={`${logo.name} Logo`} className="w-full h-full" />
                    </div>
                    <span className="text-sm text-center">{logo.name}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="paid" className="mt-6 sm:mt-8">
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-7 gap-6 sm:gap-8">
                {PREMIUM_DATASET_LOGOS.map((logo) => (
                  <div key={logo.name} className="flex flex-col items-center space-y-2">
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center">
                      <MonoLogo src={logo.src} alt={`${logo.name} Logo`} className="w-full h-full" />
                    </div>
                    <span className="text-sm text-center">{logo.name}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="flex justify-center">
              <img
                src="/assets/aa4e0a75-7d42-444e-8f29-bd985c64a491.png"
                alt={tPages("expertSection.imageAlt")}
                className="w-full max-w-lg h-auto object-cover rounded-lg"
              />
            </div>
            <div className="space-y-8 py-4">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                {tPages("expertSection.title")}
              </h2>
              <div className="space-y-8">
                {expertBlocks.map((block) => (
                  <div key={block.title}>
                    <h3 className="text-lg font-bold mb-2">{block.title}</h3>
                    <p className="text-base font-light leading-relaxed">{block.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight md:leading-[1.1] text-center mb-8 sm:mb-12">
            {tPages("pricing.title")}
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {(["freemium", "pro"] as const).map((planKey) => {
              const plan = pricingPlans[planKey];
              return (
                <Card key={planKey} className="p-8 border border-border">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold">{plan.name.toUpperCase()}</CardTitle>
                    <div className="text-sm text-muted-foreground">{plan.startingFrom}</div>
                    <div className="text-4xl font-bold text-foreground">
                      {plan.price}
                      <span className="text-lg font-normal">{plan.priceUnit}</span>
                    </div>
                    <p className="text-muted-foreground text-sm">{plan.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-primary" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                    <Button className="w-full mt-6">{plan.cta}</Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20 px-4 bg-primary">
        <div className="container mx-auto text-center">
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight md:leading-[1.1] text-primary-foreground">
              {tPages("finalCta.title")}
            </h2>
            <p className="text-primary-foreground text-base sm:text-lg">
              {tPages("finalCta.subtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to={buildLocalizedPath("/signup", language)}>
                <Button
                  variant="hero"
                  size="sm"
                  className="w-full sm:w-auto text-xs sm:text-sm md:text-base tracking-normal whitespace-normal text-center px-4 sm:px-6 min-h-[44px]"
                >
                  {tPages("finalCta.primary")}
                </Button>
              </Link>
              <Link to={buildLocalizedPath("/demo", language)}>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-primary-foreground rounded-md font-semibold font-montserrat w-full sm:w-auto hover:bg-primary-foreground/10 text-primary-foreground text-xs sm:text-sm md:text-base tracking-normal whitespace-normal text-center px-4 sm:px-6 min-h-[44px]"
                >
                  {tPages("finalCta.secondary")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

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

export default Index;