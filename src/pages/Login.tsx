import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { SSOButton } from "@/components/ui/SSOButton";
import { SSOProvider, useSSO } from "@/components/ui/SSOProvider";
import { useTranslation } from "react-i18next";
import { buildLocalizedPath } from "@i18n/routing";
import { useLanguage } from "@/providers/LanguageProvider";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { signIn, signInWithGoogle } = useAuth();
  const { ssoState, setProviderLoading, setLastError } = useSSO();
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { t } = useTranslation("pages", { keyPrefix: "login" });
  const { t: tCommon } = useTranslation("common");

  useEffect(() => {
    // Redirige vers /demo si trial expiré
    try {
      const urlParams = new URLSearchParams(location.search);
      const fromQuery = urlParams.get('trial_expired') === 'true';
      const fromSession = sessionStorage.getItem('trial_expired') === 'true';
      if (fromQuery || fromSession) {
        sessionStorage.removeItem('trial_expired');
        navigate(buildLocalizedPath('/demo', language) + '?reason=trial_expired', { replace: true });
      }
    } catch (error) {
      console.error("Failed to parse trial_expired flags", error);
    }
  }, [location, navigate, language]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);
    setLastError(null);
    
    try {
      const result = await signIn(email, password);
      
      if (result.error) {
        toast({
          variant: "destructive",
          title: tCommon("toasts.error.title"),
          description: result.error.message,
        });
        setLastError(result.error.message);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: tCommon("toasts.error.title"),
        description: tCommon("toasts.error.unexpected"),
      });
      setLastError(t("errors.unexpected"));
    } finally {
      setLoading(false);
    }
  };

  const handleSSOLogin = async (provider: 'google') => {
    setProviderLoading(provider, true);
    setLastError(null);
    
    try {
      const result = await signInWithGoogle();

      if (result.error) {
        toast({
          variant: "destructive",
          title: (t as any)("toasts.error.googleTitle"),
          description: result.error.message,
        });
        setLastError(result.error.message);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: (t as any)("toasts.error.googleTitle"),
        description: (t as any)("toasts.error.unexpected"),
      });
      setLastError(t("errors.unexpected"));
    } finally {
      setProviderLoading(provider, false);
    }
  };

  return (
    <div className="min-h-screen bg-primary flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Link 
            to={buildLocalizedPath("/", language)} 
            className="inline-flex items-center text-primary-foreground hover:opacity-80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("back")}
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 mx-auto mb-4">
              <img src="/assets/logo-ecodex-auth.png" alt="Ecodex" className="w-full h-full object-contain" />
            </div>
            <CardTitle className="text-2xl">{t("title")}</CardTitle>
            <CardDescription>
              {t("subtitle")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t("placeholders.email")}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t("placeholders.password")}
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t("loading")}
                  </>
                ) : (
                  t("submit")
                )}
              </Button>
            </form>

            <div className="my-6 text-center text-sm text-gray-500">
              <span>{t("or")}</span>
            </div>

            <SSOButton
              provider="google"
              onClick={() => handleSSOLogin('google')}
              loading={ssoState.loading.google}
              disabled={loading || ssoState.loading.google}
              icon={
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              }
            >
              {t("google")}
            </SSOButton>

            {/* Error Alert */}
            {ssoState.lastError && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {ssoState.lastError}
                </AlertDescription>
              </Alert>
            )}

            <div className="text-center mt-6">
              <p className="text-sm text-gray-600">
                {t("noAccount")} {' '}
                <Link to={buildLocalizedPath('/signup', language)} className="text-blue-600 hover:underline">
                  {t("signUp")}
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const Login = () => {
  return (
    <SSOProvider>
      <LoginForm />
    </SSOProvider>
  );
};

export default Login;