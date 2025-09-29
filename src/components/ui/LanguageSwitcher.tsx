import { Globe } from "lucide-react";
import { useLanguage } from "@/providers/LanguageProvider";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export const LanguageSwitcher = ({ align }: { align?: "start" | "center" | "end" }) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation("common");

  const handleLanguageChange = (newLang: "fr" | "en") => {
    console.log(`Switching language from ${language} to ${newLang}`);
    setLanguage(newLang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Globe className="h-4 w-4" />
          {language === "fr" ? t("language.toggle.fr") : t("language.toggle.en")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align ?? "end"} className="w-28">
        <DropdownMenuItem
          onClick={() => handleLanguageChange("fr")}
          className={language === "fr" ? "font-semibold" : undefined}
        >
          🇫🇷 {t("language.fr")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleLanguageChange("en")}
          className={language === "en" ? "font-semibold" : undefined}
        >
          🇬🇧 {t("language.en")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

