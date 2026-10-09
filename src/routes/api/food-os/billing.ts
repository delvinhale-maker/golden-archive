import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createFoodOsCheckout } from "@/lib/food-os-billing.server";

export const Route = createFileRoute("/api/food-os/billing")({
  server: {
    handlers: {
      POST: async ({request}) => {
        try {
          const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"");
          if(!token) return Response.json({error:"Authentication required"},{status:401});
          const url=process.env.SUPABASE_URL;
          const key=process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if(!url||!key) return Response.json({error:"Auth service unavailable"},{status:503});
          const auth=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
          const {data,error}=await auth.auth.getUser(token);
          if(error||!data.user) return Response.json({error:"Invalid session"},{status:401});
          const payload=await request.json();
          if(typeof payload.organizationId!=="string" || !["professional","business","enterprise"].includes(payload.plan))
            return Response.json({error:"Invalid billing request"},{status:400});
          const result=await createFoodOsCheckout(payload.organizationId,data.user.id,payload.plan);
          return Response.json(result);
        } catch(e) {
          return Response.json({error:e instanceof Error?e.message:"Checkout unavailable"},{status:400});
        }
      },
    },
  },
});
