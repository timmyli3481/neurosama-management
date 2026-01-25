import { httpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { internal } from "../_generated/api";

const http = httpRouter();

/**
 * Verify Svix webhook signature
 * Clerk uses Svix for webhook signing
 */
async function verifyWebhookSignature(
  payload: string,
  headers: {
    svixId: string;
    svixTimestamp: string;
    svixSignature: string;
  },
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();

  // Svix secret is prefixed with "whsec_", remove it and decode from base64
  const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const secretBytes = Uint8Array.from(atob(secretKey), (c) => c.charCodeAt(0));

  // Create the signed payload: "{timestamp}.{payload}"
  const signedPayload = `${headers.svixTimestamp}.${payload}`;

  // Import the key for HMAC-SHA256
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  // Sign the payload
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload),
  );

  // Convert to base64
  const expectedSignature = btoa(
    String.fromCharCode(...new Uint8Array(signatureBytes)),
  );

  // Svix signature header contains multiple signatures separated by space
  // Format: "v1,{signature} v1,{signature2} ..."
  const signatures = headers.svixSignature.split(" ");

  for (const sig of signatures) {
    const [version, signature] = sig.split(",");
    if (version === "v1" && signature === expectedSignature) {
      return true;
    }
  }

  return false;
}

/**
 * Verify timestamp is within tolerance (5 minutes)
 */
function verifyTimestamp(timestamp: string): boolean {
  const now = Math.floor(Date.now() / 1000);
  const webhookTimestamp = parseInt(timestamp, 10);
  const tolerance = 5 * 60; // 5 minutes

  return Math.abs(now - webhookTimestamp) <= tolerance;
}

/**
 * Clerk webhook event types
 */
interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserData {
  id: string;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  image_url?: string | null;
  deleted?: boolean;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData;
}

/**
 * Extract primary email from Clerk user data
 */
function extractPrimaryEmail(data: ClerkUserData): string | null {
  if (!data.email_addresses || !data.primary_email_address_id) {
    return data.email_addresses?.[0]?.email_address ?? null;
  }
  const primaryEmail = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id,
  );
  return primaryEmail?.email_address ?? data.email_addresses[0]?.email_address ?? null;
}

/**
 * Clerk webhook endpoint
 *
 * Handles:
 * - user.deleted: Clean up user from our database
 *
 * Note: User creation is handled client-side via checkAuth mutation
 */
http.route({
  path: "/clerk-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("CLERK_WEBHOOK_SECRET not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    // Get Svix headers
    const svixId = request.headers.get("svix-id");
    const svixTimestamp = request.headers.get("svix-timestamp");
    const svixSignature = request.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.error("Missing Svix headers");
      return new Response("Missing webhook headers", { status: 400 });
    }

    // Verify timestamp to prevent replay attacks
    if (!verifyTimestamp(svixTimestamp)) {
      console.error("Webhook timestamp outside tolerance");
      return new Response("Webhook timestamp expired", { status: 400 });
    }

    const body = await request.text();

    // Verify signature
    const isValid = await verifyWebhookSignature(
      body,
      { svixId, svixTimestamp, svixSignature },
      webhookSecret,
    );

    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response("Invalid signature", { status: 401 });
    }

    // Parse the event
    let event: ClerkWebhookEvent;
    try {
      event = JSON.parse(body) as ClerkWebhookEvent;
    } catch {
      console.error("Failed to parse webhook body");
      return new Response("Invalid JSON", { status: 400 });
    }

    // Handle events
    switch (event.type) {
      case "user.created": {
        const clerkId = event.data.id;
        if (clerkId) {
          // Store clerk info in database
          await ctx.runMutation(internal.auth.users.upsertClerkInfo, {
            id: clerkId,
            emailAddress: extractPrimaryEmail(event.data),
            firstName: event.data.first_name ?? null,
            lastName: event.data.last_name ?? null,
            username: event.data.username ?? null,
            imageUrl: event.data.image_url ?? null,
          });
        }
        return new Response("User created", { status: 200 });
      }

      case "user.updated": {
        const clerkId = event.data.id;
        if (clerkId) {
          // Update clerk info in database
          await ctx.runMutation(internal.auth.users.upsertClerkInfo, {
            id: clerkId,
            emailAddress: extractPrimaryEmail(event.data),
            firstName: event.data.first_name ?? null,
            lastName: event.data.last_name ?? null,
            username: event.data.username ?? null,
            imageUrl: event.data.image_url ?? null,
          });
        }
        return new Response("User updated", { status: 200 });
      }

      case "user.deleted": {
        const clerkId = event.data.id;
        if (clerkId) {
          await ctx.runMutation(internal.auth.users.deleteClerkInfo, {
            clerkId,
          });
        }
        return new Response("User deleted", { status: 200 });
      }

      default:
        // Acknowledge unknown events (don't fail)
        return new Response("Event received", { status: 200 });
    }
  }),
});

export default http;
