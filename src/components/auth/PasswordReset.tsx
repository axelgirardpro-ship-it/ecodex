import React, { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PasswordResetProps {
  onBack: () => void;
}

export const PasswordReset = ({ onBack }: PasswordResetProps) => {
  const { t } = useTranslation("pages", { keyPrefix: "passwordReset" });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: t("toasts.emailRequired.title"),
        description: t("toasts.emailRequired.description"),
      });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (error) throw error;

      setSent(true);
      toast({
        title: t("toasts.emailSent.title"),
        description: t("toasts.emailSent.description"),
      });

    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast({
        variant: "destructive",
        title: t("toasts.error.title"),
        description: error.message || t("toasts.error.description"),
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
            <Mail className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>{t("sent.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              <Trans
                i18nKey="pages:passwordReset.sent.description"
                components={{ strong: <strong /> }}
                values={{ email }}
              />
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Button variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("sent.back")}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="w-full text-sm"
            >
              {t("sent.resend")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>{t("form.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("form.subtitle")}
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">{t("form.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder={t("form.placeholder") ?? "email@example.com"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Button 
              type="submit" 
              className="w-full"
              disabled={loading || !email.trim()}
            >
              <Mail className="h-4 w-4 mr-2" />
              {loading ? t("form.sending") : t("form.submit")}
            </Button>
            
            <Button 
              type="button"
              variant="outline" 
              onClick={onBack}
              className="w-full"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t("form.back")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
