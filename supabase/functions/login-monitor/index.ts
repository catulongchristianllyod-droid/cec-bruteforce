
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const url = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false },
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  if (req.method !== "POST") {
    return respond({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const email = body.email;
    const password = body.password;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return respond(
        { error: "Email and password are required." },
        400
      );
    }

    // Only trust IP headers supplied by your hosting proxy.
    // Verify which header Supabase provides before production.
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      null;

    const userAgent = req.headers.get("user-agent");

    let isp: string | null = null;
    let city: string | null = null;
    let region: string | null = null;
    let country: string | null = null;

    // Approximate location and ISP lookup.
    if (ip) {
      try {
        const response = await fetch(
          `https://ipwho.is/${encodeURIComponent(ip)}`,
          { signal: AbortSignal.timeout(3000) }
        );

        if (response.ok) {
          const info = await response.json();

          if (info.success) {
            isp = info.connection?.isp ?? null;
            city = info.city ?? null;
            region = info.region ?? null;
            country = info.country ?? null;
          }
        }
      } catch (error) {
        console.error("IP lookup failed:", error);
      }
    }

    // Authenticate on the server.
    const authClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });

    const { data, error } =
      await authClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    const status = error ? "failed" : "success";

    // Save the authentication result and metadata.
    const { error: logError } = await admin
      .from("login_attempts")
      .insert({
        attempted_username: email.trim(),
        ip_address: ip,
        isp,
        city,
        region,
        country,
        user_agent: userAgent,
        device_info: userAgent,
        status,
        attempted_at: new Date().toISOString(),
      });

    if (logError) {
      console.error("Login monitoring error:", logError.message);
      // Do not silently accept a successful login if
      // required security logging has failed.
      if (!error) {
        return respond(
          { error: "Login monitoring is temporarily unavailable." },
          503
        );
      }
    }

    if (error) {
      return respond(
        { error: "Invalid email or password." },
        401
      );
    }

    return respond({
      success: true,
      session: data.session,
    });
  } catch (error) {
    console.error("Login monitor error:", error);

    return respond(
      { error: "Unable to process login." },
      500
    );
  }
});
