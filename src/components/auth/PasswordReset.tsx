import React, { useState } from "react";
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
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "Email requis",
        description: "Veuillez saisir votre adresse email",
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
        title: "Email envoyé !",
        description: "Vérifiez votre boîte mail pour réinitialiser votre mot de passe",
      });

    } catch (error: any) {
      console.error('Error sending reset email:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email de réinitialisation",
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
          <CardTitle>Email envoyé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Mail className="h-4 w-4" />
            <AlertDescription>
              Un email de réinitialisation a été envoyé à <strong>{email}</strong>. 
              Cliquez sur le lien dans l'email pour créer un nouveau mot de passe.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Button variant="outline" onClick={onBack} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la connexion
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
              className="w-full text-sm"
            >
              Renvoyer l'email
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle>Mot de passe oublié ?</CardTitle>
        <p className="text-sm text-muted-foreground">
          Saisissez votre email pour recevoir un lien de réinitialisation
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="votre@email.com"
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
              {loading ? "Envoi..." : "Envoyer le lien"}
            </Button>
            
            <Button 
              type="button"
              variant="outline" 
              onClick={onBack}
              className="w-full"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la connexion
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
