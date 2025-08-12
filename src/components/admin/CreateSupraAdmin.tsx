import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const CreateSupraAdmin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateSecurePassword = () => {
    const length = 16;
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let password = "";
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(password);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Erreur d'authentification",
          description: "Vous devez être connecté pour effectuer cette action.",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`https://wrodvaatdujbpfpvrzge.supabase.co/functions/v1/create-supra-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast({
          title: "Succès",
          description: result.message,
        });
        setEmail("");
        setPassword("");
      } else {
        toast({
          title: "Erreur",
          description: result.error || "Une erreur est survenue lors de la création du compte.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error creating supra admin:', error);
      toast({
        title: "Erreur",
        description: "Une erreur inattendue est survenue.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isPasswordStrong = (pwd: string) => {
    return pwd.length >= 12 && 
           /[A-Z]/.test(pwd) && 
           /[a-z]/.test(pwd) && 
           /[0-9]/.test(pwd) && 
           /[!@#$%^&*]/.test(pwd);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          Créer un Supra Admin
        </CardTitle>
        <CardDescription>
          Créer un nouveau compte super administrateur avec des privilèges élevés.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleCreateAdmin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe sécurisé"
                required
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={generateSecurePassword}
              className="w-full"
            >
              Générer un mot de passe sécurisé
            </Button>
          </div>

          {password && (
            <Alert>
              <AlertDescription>
                Force du mot de passe: {isPasswordStrong(password) ? "✅ Fort" : "❌ Faible"}
                {!isPasswordStrong(password) && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Le mot de passe doit contenir au moins 12 caractères, incluant majuscules, minuscules, chiffres et symboles.
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !isPasswordStrong(password)}
          >
            {isLoading ? "Création en cours..." : "Créer le compte"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};