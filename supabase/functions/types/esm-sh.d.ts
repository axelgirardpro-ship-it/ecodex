declare module 'https://esm.sh/@supabase/supabase-js@2' {
	// Minimal stub pour satisfaire TypeScript côté Deno edge
	export const createClient: (...args: any[]) => any
}

declare module 'https://deno.land/std@0.190.0/http/server.ts' {
	export function serve(handler: (req: Request) => Response | Promise<Response>): void
}
