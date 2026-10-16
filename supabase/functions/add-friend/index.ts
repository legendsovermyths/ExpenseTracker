// Supabase Edge Function — public landing URL for friend QR codes.
//
// Custom-scheme links (expensifyfinance://…) aren't recognised by the stock
// camera or generic QR scanners, so QR codes encode this https URL instead.
// It just validates the params and 302s into the app's deep link, which the
// browser then hands off to Expensify.
//
// Must be deployed without JWT verification (scanners can't send a token):
//   supabase functions deploy add-friend --no-verify-jwt

const APP_SCHEME = "expensifyfinance";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve((req) => {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") ?? "";
  const name = (url.searchParams.get("name") ?? "").slice(0, 80);

  if (!UUID_RE.test(id)) {
    return new Response("Invalid Expensify friend link", { status: 400 });
  }

  const target = `${APP_SCHEME}://add-friend?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
});
