import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

type FoodPlan = "professional" | "business" | "enterprise";
const plans: Record<FoodPlan, string | undefined> = {
  professional: process.env.FOOD_OS_PROFESSIONAL_PRICE_ID,
  business: process.env.FOOD_OS_BUSINESS_PRICE_ID,
  enterprise: process.env.FOOD_OS_ENTERPRISE_PRICE_ID,
};
function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe not configured");
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
function db() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Food OS database not configured");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{persistSession:false,autoRefreshToken:false}});
}
export async function createFoodOsCheckout(organizationId:string, ownerId:string, plan:FoodPlan) {
  const database=db();
  const {data: membership,error}=await database.from("assurance_memberships").select("role").eq("organization_id",organizationId).eq("user_id",ownerId).in("role",["owner","compliance_admin"]).maybeSingle();
  if(error||!membership) throw new Error("Organization billing access denied");
  const price=plans[plan];
  if(!price) throw new Error("Food OS plan price not configured");
  const origin=process.env.FOOD_OS_APP_URL;
  if(!origin || !/^https:\/\//.test(origin)) throw new Error("Food OS application URL not configured");
  const session=await stripe().checkout.sessions.create({
    mode:"subscription",line_items:[{price,quantity:1}],
    success_url:`${origin}/food-os?billing=success`,
    cancel_url:`${origin}/food-os?billing=cancelled`,
    client_reference_id:organizationId,
    metadata:{kind:"FOOD_OS",organizationId,ownerId,plan},
    subscription_data:{metadata:{kind:"FOOD_OS",organizationId,ownerId,plan}},
  });
  if(!session.url) throw new Error("Stripe checkout URL unavailable");
  return {url:session.url};
}
async function sync(subscription:Stripe.Subscription) {
  if(subscription.metadata.kind!=="FOOD_OS") return false;
  const organizationId=subscription.metadata.organizationId;
  const plan=subscription.metadata.plan;
  if(!organizationId || !["professional","business","enterprise"].includes(plan)) throw new Error("Invalid Food OS subscription metadata");
  const item=subscription.items.data[0];
  const active=subscription.status==="active"||subscription.status==="trialing";
  const {error}=await db().from("food_os_entitlements").upsert({
    organization_id:organizationId,plan_key:plan,
    status:subscription.status==="trialing"?"trialing":active?"active":subscription.status==="past_due"?"past_due":subscription.status==="canceled"?"canceled":"expired",
    stripe_customer_id:typeof subscription.customer==="string"?subscription.customer:subscription.customer.id,
    stripe_subscription_id:subscription.id,
    period_start:item?.current_period_start?new Date(item.current_period_start*1000).toISOString():null,
    period_end:item?.current_period_end?new Date(item.current_period_end*1000).toISOString():null,
    trial_end:subscription.trial_end?new Date(subscription.trial_end*1000).toISOString():null,
    updated_at:new Date().toISOString(),
  },{onConflict:"organization_id"});
  if(error) throw error;
  return true;
}
export async function handleFoodOsStripeWebhook(body:string,signature:string) {
  const secret=process.env.FOOD_OS_STRIPE_WEBHOOK_SECRET;
  if(!secret) throw new Error("Food OS webhook secret not configured");
  const event=stripe().webhooks.constructEvent(body,signature,secret);
  if(event.type==="checkout.session.completed" && event.data.object.metadata?.kind==="FOOD_OS" && typeof event.data.object.subscription==="string")
    return sync(await stripe().subscriptions.retrieve(event.data.object.subscription));
  if(["customer.subscription.created","customer.subscription.updated","customer.subscription.deleted"].includes(event.type))
    return sync(event.data.object as Stripe.Subscription);
  return false;
}
