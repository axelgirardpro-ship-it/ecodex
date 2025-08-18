import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Facebook, Twitter, Linkedin, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { MonoLogo } from "@/components/ui/MonoLogo";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Détecter si l'utilisateur arrive avec des tokens d'invitation
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    
    const accessToken = urlParams.get('access_token') || hashParams.get('access_token');
    const type = urlParams.get('type') || hashParams.get('type');
    
    // Si on détecte une invitation (tokens + type signup), rediriger vers /invitation
    if (accessToken && (type === 'signup' || type === 'invite')) {
      console.log('Invitation détectée sur la page d\'accueil, redirection...');
      navigate('/invitation' + window.location.search + window.location.hash);
      return;
    }
    
    // Si l'utilisateur est connecté et a des métadonnées d'invitation, rediriger aussi
    if (user?.user_metadata?.workspace_id && user?.user_metadata?.invitation_type === 'workspace') {
      console.log('Utilisateur connecté avec invitation en attente, redirection...');
      navigate('/invitation');
      return;
    }
  }, [navigate, user]);
  return <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="bg-background border-b border-border sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
        {/* Logo */}
        <div className="flex-shrink-0">
          <img src="/lovable-uploads/415a981c-a454-47dc-a601-b214f6e857d0.png" alt="DataCarb" className="h-16" />
        </div>
        
        {/* Boutons de navigation */}
        <div className="flex items-center space-x-4">
          <Link to="/signup">
            <Button variant="outline">
              S'inscrire
            </Button>
          </Link>
          <Link to="/login">
            <Button>
              Se connecter
            </Button>
          </Link>
        </div>
          </div>
        </div>
      </nav>
      {/* Hero Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Colonne gauche : H1, Paragraphe, CTAs */}
            <div className="space-y-6 order-2 lg:order-1">
              <h1 className="text-5xl md:text-6xl font-bold leading-tight text-primary-foreground">
                Le moteur de recherche<br />
                de FE le plus puissant<br />
                du marché
              </h1>
              <p className="text-primary-foreground/90">
                Accédez à plus de 255 000 facteurs d'émissions français et internationaux<br />
                agrégés et enrichis par nos experts.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <Button variant="hero" className="w-full sm:w-auto">
                    Tester le moteur de recherche
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" className="w-full sm:w-auto border-primary-foreground text-primary-foreground hover:bg-primary-foreground/10">
                    Se connecter
                  </Button>
                </Link>
              </div>
            </div>
            
            {/* Colonne droite : Image */}
            <div className="order-1 lg:order-2">
              <img src="/lovable-uploads/b3596089-c93c-4b3d-87ea-8598f493120b.png" alt="Interface de recherche de facteurs d'émission" className="w-full h-auto rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Partner Logos Section */}
  <section className="py-16 bg-background">
    <div className="container mx-auto px-4 text-center">
      <h4 className="font-bold mb-12">
            Retrouvez les plus grandes bases françaises et internationales
          </h4>
          <div className="grid grid-cols-7 gap-8 items-center">
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/3fdbfe68-8e5e-4c44-8ac1-edd24a2d8fac.png" alt="Empreinte" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/ac4b2170-676b-424b-906d-7f65f939022c.png" alt="Ecobalyse" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/f51cec17-9b6f-417a-919b-c29f1a77ac1a.png" alt="exiobase" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/9d73d9ce-baf8-4a47-bdd7-bcbcc41e709d.png" alt="inies" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/8edc4de0-1e88-4d97-972f-ed5d481c1b30.png" alt="AGRI BALYSE" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/a39b6717-f7d1-4045-a4ab-921fe28e5c53.png" alt="Electricity Maps" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/c27135f4-de5c-49fd-9e9f-4dc89a29274f.png" alt="PCAF" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/5310da27-1ab7-4efe-a090-a25937048f60.png" alt="ecoinvent" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/08a66c66-7e5d-4050-918f-aa08fd2d8612.png" alt="AIB" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/aa03a266-0170-4b29-b12a-2f86dea065a2.png" alt="EMBER" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/c0650cbc-f7d4-40e6-a022-e6b2bac57c2a.png" alt="Climate Trace" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/ba02a326-86d5-4773-8777-e613296e2582.png" alt="European Environment Agency" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/2d97e89d-91a3-4143-8432-605a4422e9f0.png" alt="Department for Business, Energy & Industrial Strategy" className="max-h-[50px] w-full h-[50px]" />
            </div>
            <div className="flex flex-col items-center">
              <MonoLogo src="/lovable-uploads/01ca909f-ef8b-4b32-aea1-50f98ae9e4a6.png" alt="eco" className="max-h-[50px] w-full h-[50px]" />
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-12">
            Découvrez la puissance<br />
            du moteur de recherche
          </h2>
          <div className="max-w-4xl mx-auto">
            <div style={{
            position: "relative",
            paddingBottom: "calc(52.44791666666667% + 41px)",
            height: 0,
            width: "100%"
          }}>
              <iframe src="https://demo.arcade.software/rg5Pizw2AGo4sO73KGPN?embed&embed_mobile=tab&embed_desktop=inline&show_copy_link=true" title="Moteur de recherche de FE Sami - Démo" frameBorder="0" loading="lazy" style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              colorScheme: "light"
            }} allow="clipboard-write" className="rounded-lg" />
            </div>
          </div>
        </div>
      </section>

      {/* Features Tabs Section */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
  <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
    Un moteur de recherche<br />
    puissant et personnalisable
  </h2>
  <Tabs defaultValue="donnees" className="max-w-6xl mx-auto">
    <TabsList className="grid w-full grid-cols-4 mb-12 rounded-full items-center">
              <TabsTrigger value="donnees" className="rounded-full">Données</TabsTrigger>
              <TabsTrigger value="recherche" className="rounded-full">Recherche</TabsTrigger>
              <TabsTrigger value="personnalisation" className="rounded-full">Personnalisation</TabsTrigger>
              <TabsTrigger value="plus-loin" className="rounded-full">Pour aller plus loin</TabsTrigger>
            </TabsList>
            <TabsContent value="donnees" className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-8 py-4">
      <h3 className="text-3xl font-bold leading-tight">
        Le guichet unique de vos<br />
        données carbone
      </h3>
      <div className="space-y-8">
        <div>
          <h4 className="text-lg font-semibold mb-2">Une donnée structurée</h4>
          <p className="text-base font-light leading-relaxed">Une structuration unique et homogène de plus de 20 bases de<br />données de références internationales.</p>
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-2">Une donnée à jour</h4>
          <p className="text-base font-light leading-relaxed">Une mise à jour en continu des bases pour une garantie de<br />qualité des FE.</p>
        </div>
        <div>
          <h4 className="text-lg font-semibold mb-2">+ 250K FE à disposition</h4>
          <p className="text-base font-light leading-relaxed">Plus de 250k FE génériques et spécifiques en cumulé,<br />disponibles au sein d'une structure commune.</p>
        </div>
      </div>
              </div>
              <div className="bg-white rounded-lg p-6">
                <img src="/lovable-uploads/71d74bc4-61b0-4e95-befc-12b9508a15e4.png" alt="Interface base de données" className="w-full h-auto" />
              </div>
            </TabsContent>
            <TabsContent value="recherche" className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-8 py-4">
    <h3 className="text-3xl font-bold leading-tight">
      Moteur fluide et simple<br />
      d'utilisation
    </h3>
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-semibold mb-2">Recherche intelligente</h4>
        <p className="text-base font-light leading-relaxed">Recherchez par mots-clés, codes, catégories ou filtres<br />avancés pour trouver rapidement vos FE.</p>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Interface intuitive</h4>
        <p className="text-base font-light leading-relaxed">Navigation simple et rapide avec des suggestions<br />automatiques et tri personnalisable.</p>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Résultats précis</h4>
        <p className="text-base font-light leading-relaxed">Algorithme optimisé pour vous proposer les facteurs<br />d'émission les plus pertinents selon vos critères.</p>
      </div>
    </div>
              </div>
              <div className="bg-white rounded-lg p-6">
                <img src="/lovable-uploads/501e99e2-29fe-4086-8d1f-9bd8028d151d.png" alt="Interface de recherche" className="w-full h-auto" />
              </div>
            </TabsContent>
            <TabsContent value="personnalisation" className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-8 py-4">
    <h3 className="text-3xl font-bold leading-tight">
      Personnalisez le moteur<br />
      selon vos besoins
    </h3>
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-semibold mb-2">Favoris et collections</h4>
        <p className="text-base font-light leading-relaxed">Sauvegardez vos FE préférés et créez des collections<br />thématiques pour un accès rapide.</p>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Filtres personnalisés</h4>
        <p className="text-base font-light leading-relaxed">Configurez des filtres selon vos secteurs d'activité<br />et vos besoins métier spécifiques.</p>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Données sur-mesure</h4>
        <p className="text-base font-light leading-relaxed">Intégrez vos propres FE spécifiques et créez votre<br />base de données personnalisée.</p>
      </div>
    </div>
              </div>
              <div className="bg-white rounded-lg p-6">
                <img src="/lovable-uploads/e3feeaa6-9229-46a9-a227-0700f479943f.png" alt="Interface de personnalisation" className="w-full h-auto" />
              </div>
            </TabsContent>
            <TabsContent value="plus-loin" className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="space-y-8 py-4">
    <h3 className="text-3xl font-bold leading-tight">
      Allez plus loin que<br />
      la recherche de FE
    </h3>
    <div className="space-y-8">
      <div>
        <h4 className="text-lg font-semibold mb-2">Réalisez des benchmarks approfondis</h4>
        <p className="text-base font-light leading-relaxed">Positionnez facilement un produit ou une entreprise par<br />rapport à des concurrents et des moyennes sectorielles de marché.</p>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Plan d'action et décarbonation</h4>
        <p className="text-base font-light leading-relaxed">Identifiez rapidement les bénéfices de changements de produits,<br />relocalisation, de fournisseurs (achats responsables), etc.</p>
      </div>
      <div>
        <h4 className="text-lg font-semibold mb-2">Support expert</h4>
        <p className="text-base font-light leading-relaxed">Bénéficiez de l'accompagnement de nos experts<br />carbone pour optimiser vos calculs.</p>
      </div>
    </div>
              </div>
              <div className="bg-white rounded-lg p-6">
                <img src="/lovable-uploads/d9ebca49-6f11-4b52-a6b0-07a9d348c5b2.png" alt="Interface avancée" className="w-full h-auto" />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Databases Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
            Toutes les bases de données<br />
            sur une seule plateforme
          </h2>
          <Tabs defaultValue="standards" className="max-w-6xl mx-auto">
            <TabsList className="grid w-full grid-cols-2 mb-12 rounded-full items-center">
              <TabsTrigger value="standards" className="rounded-full">Datasets standards</TabsTrigger>
              <TabsTrigger value="premium" className="rounded-full">Datasets premium</TabsTrigger>
            </TabsList>
            <TabsContent value="standards">
              <div className="grid grid-cols-7 gap-8">
                {["AIB", "Agribalyse", "BEIS", "Base Carbone", "Base Impacts", "CCF", "Climate Trace", "EEA", "EPA", "Exiobase", "EcoInvent", "Ecobalyse", "Electricity Maps", "Ember", "GESPoint5", "GLEC", "Kering", "OMEGA TP", "Open CEDA", "PCAF"].map((name, index) => <div key={index} className="flex flex-col items-center space-y-2">
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center">
                      {name === "AIB" ? (
                        <MonoLogo src="/lovable-uploads/04c097ec-c73b-4fb8-8788-7db8dce6aae6.png" alt="AIB Logo" className="w-full h-full" />
                      ) : name === "Agribalyse" ? (
                        <MonoLogo src="/lovable-uploads/fda086b7-f932-4837-beff-453157e04098.png" alt="Agribalyse Logo" className="w-full h-full" />
                      ) : name === "BEIS" ? (
                        <MonoLogo src="/lovable-uploads/6a36c45c-748d-4f7b-83c3-06ab2651649f.png" alt="BEIS Logo" className="w-full h-full" />
                      ) : name === "Base Carbone" ? (
                        <MonoLogo src="/lovable-uploads/e9be0482-b48d-476b-8536-b92ea3b88ea5.png" alt="Base Carbone Logo" className="w-full h-full" />
                      ) : name === "Base Impacts" ? (
                        <MonoLogo src="/lovable-uploads/8351c94f-afcc-498e-b8fa-73f47451686a.png" alt="Base Impacts Logo" className="w-full h-full" />
                      ) : name === "CCF" ? (
                        <MonoLogo src="/lovable-uploads/c9bb06bc-2cc4-4420-9704-4c9f16118e97.png" alt="CCF Logo" className="w-full h-full" />
                      ) : name === "Climate Trace" ? (
                        <MonoLogo src="/lovable-uploads/47300cd4-f205-4264-a5b0-6f1406b312f8.png" alt="Climate Trace Logo" className="w-full h-full" />
                      ) : name === "EEA" ? (
                        <MonoLogo src="/lovable-uploads/d2dffb4b-f32d-43ed-82bf-b071db714f91.png" alt="European Environment Agency Logo" className="w-full h-full" />
                      ) : name === "EPA" ? (
                        <MonoLogo src="/lovable-uploads/75c9eac2-554f-4bb0-9719-08a698c80e1d.png" alt="US EPA Logo" className="w-full h-full" />
                      ) : name === "Exiobase" ? (
                        <MonoLogo src="/lovable-uploads/373cff1a-5089-4167-b40a-38ff4d50cc36.png" alt="Exiobase Logo" className="w-full h-full" />
                      ) : name === "EcoInvent" ? (
                        <MonoLogo src="/lovable-uploads/5cc1caa1-f312-4760-849c-0b4ec3ab5f76.png" alt="EcoInvent Logo" className="w-full h-full" />
                      ) : name === "Ecobalyse" ? (
                        <MonoLogo src="/lovable-uploads/f775ed4f-912f-41cf-9ade-08338aadf665.png" alt="Ecobalyse Logo" className="w-full h-full" />
                      ) : name === "Electricity Maps" ? (
                        <MonoLogo src="/lovable-uploads/0cc5974c-e436-42f5-9776-ad4cd768b072.png" alt="Electricity Maps Logo" className="w-full h-full" />
                      ) : name === "Ember" ? (
                        <MonoLogo src="/lovable-uploads/88e14343-4589-4e34-b420-395130de1641.png" alt="Ember Logo" className="w-full h-full" />
                      ) : name === "GESPoint5" ? (
                        <MonoLogo src="/lovable-uploads/8de84824-fb1b-441b-a7c2-50b92b4072e2.png" alt="1point5 Logo" className="w-full h-full" />
                      ) : name === "GLEC" ? (
                        <MonoLogo src="/lovable-uploads/a5f3dea0-840a-4eed-b0ce-58ef94a75d67.png" alt="GLEC Logo" className="w-full h-full" />
                      ) : name === "Kering" ? (
                        <MonoLogo src="/lovable-uploads/faa38581-8c17-443c-b8de-77a4ffc6c72e.png" alt="Kering Logo" className="w-full h-full" />
                      ) : name === "OMEGA TP" ? (
                        <MonoLogo src="/lovable-uploads/4cce460f-a743-4cdf-9fdf-215ba86522d8.png" alt="OMEGA TP Logo" className="w-full h-full" />
                      ) : name === "Open CEDA" ? (
                        <MonoLogo src="/lovable-uploads/6bd2c0d0-f9d1-4f7d-853f-cc2a7932bff5.png" alt="Open CEDA Logo" className="w-full h-full" />
                      ) : name === "PCAF" ? (
                        <MonoLogo src="/lovable-uploads/b5978785-2cff-49c0-996a-225457820050.png" alt="PCAF Logo" className="w-full h-full" />
                      ) : (
                        <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                          <div className="w-8 h-8 bg-primary rounded"></div>
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-center">{name}</span>
                  </div>)}
              </div>
            </TabsContent>
            <TabsContent value="premium">
              <div className="grid grid-cols-7 gap-8">
                {["Inies", "Eco-platform", "EcoInvent"].map((name, index) => <div key={index} className="flex flex-col items-center space-y-2">
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center">
                      {name === "Inies" ? (
                        <MonoLogo src="/lovable-uploads/59011962-91d0-4310-a1a6-4ce1c3bbb4b6.png" alt="Inies Logo" className="w-full h-full" />
                      ) : name === "Eco-platform" ? (
                        <MonoLogo src="/lovable-uploads/7d492fef-d5aa-4fa5-9732-938c9b53680d.png" alt="Eco-platform Logo" className="w-full h-full" />
                      ) : name === "EcoInvent" ? (
                        <MonoLogo src="/lovable-uploads/95586b3d-873f-4be8-a627-63fce61a19fd.png" alt="EcoInvent Logo" className="w-full h-full" />
                      ) : (
                         <div className="w-16 h-16 bg-primary/10 rounded-lg flex items-center justify-center">
                           <div className="w-8 h-8 bg-primary rounded"></div>
                         </div>
                      )}
                    </div>
                    <span className="text-sm text-center">{name}</span>
                  </div>)}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </section>

      {/* Expert Section */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div className="flex justify-center">
              <img src="/lovable-uploads/aa4e0a75-7d42-444e-8f29-bd985c64a491.png" alt="Expert" className="w-full max-w-lg h-auto object-cover rounded-lg" />
            </div>
            <div className="space-y-8 py-4">
              <h2 className="text-3xl md:text-4xl font-bold leading-tight">
                Une base de données<br />
                structurée et enrichie par nos<br />
                experts
              </h2>
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-bold mb-2">Des bases de données nettoyées et structurées</h3>
                  <p className="text-base font-light leading-relaxed">Nos experts nettoient et restructurent l'ensemble des bases de données intégrées afin de disposer d'un format unique de données.</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">Enrichissement des bases de données</h3>
                  <p className="text-base font-light leading-relaxed">Vérification des facteurs par poste d'émissions, correction des effets de l'inflation, traduction des métadonnées...</p>
                </div>
                <div>
                  <h3 className="text-lg font-bold mb-2">Versionnage</h3>
                  <p className="text-base font-light leading-relaxed">Profitez d'un versionnage d'un maintien en temps réel de la base au gré des mises à jour des différentes sources de données.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-12">
            Un prix qui s'adapte<br />
            à vos besoins
          </h2>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="p-8 border border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold">STANDARD</CardTitle>
                <div className="text-sm text-muted-foreground">À partir de</div>
                <div className="text-4xl font-bold text-foreground">850€<span className="text-lg font-normal">/an</span></div>
                <p className="text-muted-foreground text-sm">Profitez des datasets standards et du moteur de recherche</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Accès au moteur de recherche</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Datasets standards (165k FE)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Mises à jour hebdomadaires</span>
                </div>
                <Button className="w-full mt-6">En savoir plus</Button>
              </CardContent>
            </Card>

            <Card className="p-8 relative border border-border">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-semibold">PREMIUM</CardTitle>
                <div className="text-sm text-muted-foreground">À partir de</div>
                <div className="text-4xl font-bold text-foreground">3000€<span className="text-lg font-normal">/an</span></div>
                <p className="text-muted-foreground text-sm">Profitez des bases standards et premium et des fonctionnalités d'exports de données</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Accès au moteur de recherche</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Datasets standards (165k FE)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Datasets premium (90K FE)</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Mises à jour hebdomadaires</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Gestion des favoris</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Export des données</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Assistance de nos experts</span>
                </div>
                <Button className="w-full mt-6">En savoir plus</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-4 bg-primary">
        <div className="container mx-auto text-center">
          <div className="space-y-6 max-w-2xl mx-auto">
            <h2 className="text-5xl md:text-6xl font-bold text-primary-foreground">
              Prêt à explorer nos facteurs d'émission ?
            </h2>
            <p className="text-primary-foreground text-lg">
              Accédez dès maintenant au moteur de recherche le plus puissant du marché
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button variant="hero" className="w-full sm:w-auto">
                  Tester le moteur de recherche
                </Button>
              </Link>
              <Link to="/login">
                <Button variant="outline" className="border-primary-foreground px-8 py-3 rounded-md font-semibold font-montserrat w-full sm:w-auto hover:bg-primary-foreground/10 text-primary-foreground">
                  Se connecter
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="bg-primary text-primary-foreground py-16">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center text-center space-y-8">
            <img src="/lovable-uploads/c8972ef9-8dcc-4223-95de-2f4927d40419.png" alt="DataCarb" className="h-12" />
            <p className="text-primary-foreground/80 max-w-md">
              Le moteur de recherche de facteurs d'émission le plus puissant du marché.
            </p>
            <div className="flex space-x-4">
              <Button variant="ghost" size="sm" className="p-2 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" className="p-2 text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/10">
                <Mail className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0 w-full pt-8 border-t border-primary-foreground/20">
              <div className="text-primary-foreground/80 text-sm">
                © 2025 DataCarb. Tous droits réservés.
              </div>
              <div className="flex space-x-6 text-sm text-primary-foreground/80">
                <Link to="/privacy" className="hover:text-primary-foreground transition-colors">
                  Politique de confidentialité
                </Link>
                <Link to="/terms" className="hover:text-primary-foreground transition-colors">
                  Conditions d'utilisation
                </Link>
                <Link to="/cookies" className="hover:text-primary-foreground transition-colors">
                  Cookies
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>;
};
export default Index;