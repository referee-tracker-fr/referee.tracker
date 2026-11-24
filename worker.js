// Sert les fichiers de l'app et ajoute les en-têtes de sécurité (impossibles sur GitHub Pages).
const ENTETES = {
  // SAMEORIGIN (pas DENY) : l'app imprime ses propres PDF (docs/rapports/) dans un cadre caché.
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy": "frame-ancestors 'self'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};

export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    // Dossier (/) : on sert son index.html, sans changer l'adresse.
    const chemin = u.pathname.endsWith("/") ? u.pathname + "index.html" : u.pathname;
    let r = await env.ASSETS.fetch(new URL(chemin, u), req);
    const sansExtension = !u.pathname.endsWith("/") && !u.pathname.split("/").pop().includes(".");
    if (r.status === 404 && sansExtension) {
      // Comme GitHub Pages : /cgu -> cgu.html (servie telle quelle), /manuel -> /manuel/ si le dossier a un index.
      const page = await env.ASSETS.fetch(new URL(u.pathname + ".html", u), req);
      if (page.ok) r = page;
      else if ((await env.ASSETS.fetch(new URL(u.pathname + "/index.html", u))).ok) { u.pathname += "/"; return Response.redirect(u.toString(), 301); }
    }
    const h = new Headers(r.headers);
    for (const [k, v] of Object.entries(ENTETES)) h.set(k, v);
    if (r.status === 404) return new Response("Page introuvable", { status: 404, headers: h });
    return new Response(r.body, { status: r.status, headers: h });
  },
};
