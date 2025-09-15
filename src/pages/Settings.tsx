import { useState, useEffect } from "react";
import { UnifiedNavbar } from "@/components/ui/UnifiedNavbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings as SettingsIcon, Bell, Shield, CreditCard, Download, User, Building, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { usePermissions } from "@/hooks/usePermissions";
import { WorkspaceUsersManager } from "@/components/workspace/WorkspaceUsersManager";
import { RoleGuard } from "@/components/ui/RoleGuard";

const Settings = () => {
  const { user } = useAuth();
  const { userProfile, loading: userLoading } = useUser();
  const { currentWorkspace, loading: workspaceLoading } = useWorkspace();
  const permissions = usePermissions();
  
  const [notifications, setNotifications] = useState({
    email: true,
    favoriteUpdates: false,
    newFeatures: true,
    weeklyReport: false
  });
  
  const [preferences, setPreferences] = useState({
    language: "fr",
    timezone: "Europe/Paris",
    defaultUnits: "metric",
    resultsPerPage: "20"
  });

  const { toast } = useToast();

  const handleNotificationChange = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
    toast({
      title: "Paramètre mis à jour",
      description: "Vos préférences de notification ont été sauvegardées",
    });
  };

  const handlePreferenceChange = (key: string, value: string) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
    toast({
      title: "Paramètre mis à jour",
      description: "Vos préférences ont été sauvegardées",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <UnifiedNavbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center homepage-text">
            <SettingsIcon className="w-8 h-8 mr-3 text-primary" />
            Paramètres
          </h1>
          <p className="text-muted-foreground">
            Personnalisez votre expérience Ecodex
          </p>
          </div>
          
          {/* User Profile */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Informations du compte
              </CardTitle>
              <CardDescription>
                Informations générales sur votre compte
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {userLoading ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Email</Label>
                      <Skeleton className="h-4 w-full mt-1" />
                    </div>
                    <div>
                      <Label>Nom complet</Label>
                      <Skeleton className="h-4 w-full mt-1" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Email</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {user?.email || 'Non renseigné'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Nom complet</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile?.first_name && userProfile?.last_name 
                        ? `${userProfile.first_name} ${userProfile.last_name}`
                        : 'Non renseigné'}
                    </p>
                  </div>
                </div>
              )}
              
              <Separator />
              
              {userLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Rôle</Label>
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                  <div>
                    <Label>Plan du workspace</Label>
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Rôle</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile?.role || 'Non assigné'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Plan du workspace</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {userProfile?.plan_type || 'Freemium'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Workspace */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Workspace
              </CardTitle>
              <CardDescription>
                Informations sur votre espace de travail
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {workspaceLoading ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nom du workspace</Label>
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                  <div>
                    <Label>Plan</Label>
                    <Skeleton className="h-4 w-full mt-1" />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Nom du workspace</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentWorkspace?.name || 'Aucun workspace'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Plan</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {currentWorkspace?.plan_type || 'Freemium'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gestion de l'équipe - Visible uniquement pour les admins */}
          <RoleGuard requirePermission="canManageUsers">
            <div className="mb-6">
              <WorkspaceUsersManager />
            </div>
          </RoleGuard>

          {/* Notifications */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Notifications
              </CardTitle>
              <CardDescription>
                Gérez vos préférences de notification
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Notifications par email</Label>
                  <p className="text-sm text-muted-foreground">
                    Recevoir les notifications importantes par email
                  </p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) => handleNotificationChange("email", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Mises à jour des favoris</Label>
                  <p className="text-sm text-muted-foreground">
                    Être notifié quand les facteurs en favoris sont mis à jour
                  </p>
                </div>
                <Switch
                  checked={notifications.favoriteUpdates}
                  onCheckedChange={(checked) => handleNotificationChange("favoriteUpdates", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Nouvelles fonctionnalités</Label>
                  <p className="text-sm text-muted-foreground">
                    Être informé des nouvelles fonctionnalités
                  </p>
                </div>
                <Switch
                  checked={notifications.newFeatures}
                  onCheckedChange={(checked) => handleNotificationChange("newFeatures", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Rapport hebdomadaire</Label>
                  <p className="text-sm text-muted-foreground">
                    Recevoir un résumé de votre activité chaque semaine
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyReport}
                  onCheckedChange={(checked) => handleNotificationChange("weeklyReport", checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Préférences</CardTitle>
              <CardDescription>
                Personnalisez l'interface et le comportement de l'application
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Langue</Label>
                  <Select 
                    value={preferences.language} 
                    onValueChange={(value) => handlePreferenceChange("language", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fuseau horaire</Label>
                  <Select 
                    value={preferences.timezone} 
                    onValueChange={(value) => handlePreferenceChange("timezone", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Paris">Paris (UTC+1)</SelectItem>
                      <SelectItem value="Europe/London">Londres (UTC+0)</SelectItem>
                      <SelectItem value="America/New_York">New York (UTC-5)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Unités par défaut</Label>
                  <Select 
                    value={preferences.defaultUnits} 
                    onValueChange={(value) => handlePreferenceChange("defaultUnits", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="metric">Métrique</SelectItem>
                      <SelectItem value="imperial">Impérial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Résultats par page</Label>
                  <Select 
                    value={preferences.resultsPerPage} 
                    onValueChange={(value) => handlePreferenceChange("resultsPerPage", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Sécurité
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Authentification à deux facteurs</Label>
                  <p className="text-sm text-muted-foreground">
                    Sécurisez votre compte avec 2FA
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Configurer
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Sessions actives</Label>
                  <p className="text-sm text-muted-foreground">
                    Gérer les appareils connectés
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Voir les sessions
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Billing */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Facturation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Plan actuel</Label>
                  <p className="text-sm text-muted-foreground">
                    {currentWorkspace?.plan_type === 'premium' ? 'Plan Premium - Illimité' :
                     currentWorkspace?.plan_type === 'standard' ? 'Plan Standard - 100 recherches/mois' :
                     'Plan Gratuit - 10 recherches/mois'}
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const mailtoLink = `mailto:axelgirard.pro@gmail.com?subject=${encodeURIComponent('demande de plan payant')}`;
                    window.location.href = mailtoLink;
                  }}
                >
                  Passer sur un plan payant
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label>Historique de facturation</Label>
                  <p className="text-sm text-muted-foreground">
                    Télécharger vos factures
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Data & Privacy */}
          <Card>
            <CardHeader>
              <CardTitle>Données et confidentialité</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Exporter mes données
                </Button>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  Supprimer mes recherches
                </Button>
                <Button variant="destructive" size="sm" className="w-full justify-start">
                  Supprimer mon compte
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;