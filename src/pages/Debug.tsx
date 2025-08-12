import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Debug() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const testSession = async () => {
    setLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      setDebugInfo(prev => ({
        ...prev,
        session: {
          exists: !!session,
          userId: session?.user?.id,
          email: session?.user?.email,
          accessToken: session?.access_token ? "Present" : "Missing",
          error: error?.message
        }
      }));
    } catch (err) {
      setDebugInfo(prev => ({
        ...prev,
        session: { error: err instanceof Error ? err.message : String(err) }
      }));
    }
    setLoading(false);
  };

  const testCreateCheckout = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No session found");
      }

      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { planType: 'standard' },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      setDebugInfo(prev => ({
        ...prev,
        createCheckout: {
          success: !error,
          data,
          error: error?.message,
          url: data?.url
        }
      }));

      if (data?.url) {
        toast({
          title: "Success",
          description: "Checkout URL generated successfully",
        });
      }
    } catch (err) {
      setDebugInfo(prev => ({
        ...prev,
        createCheckout: { error: err instanceof Error ? err.message : String(err) }
      }));
    }
    setLoading(false);
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <h1 className="text-3xl font-bold">Debug Stripe Integration</h1>
      
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Auth Context Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p><strong>User ID:</strong> {user?.id || "Not found"}</p>
            <p><strong>Email:</strong> {user?.email || "Not found"}</p>
            <p><strong>Subscription Status:</strong> Plan type déplacé vers GlobalState</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testSession} disabled={loading}>
              Test Session
            </Button>
            {debugInfo.session && (
              <pre className="text-sm bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(debugInfo.session, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Checkout Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={testCreateCheckout} disabled={loading}>
              Test Create Checkout
            </Button>
            {debugInfo.createCheckout && (
              <pre className="text-sm bg-muted p-2 rounded overflow-auto">
                {JSON.stringify(debugInfo.createCheckout, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm bg-muted p-2 rounded overflow-auto max-h-96">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}