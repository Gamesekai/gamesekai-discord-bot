import express from "express";
import crypto from "crypto";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();

// Shopify envoie du JSON brut pour la vérification HMAC
app.use(express.raw({ type: "application/json" }));

/* =========================
   DISCORD BOT
========================= */
const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log("🤖 Bot GameSekai connecté");
});

client.login(process.env.DISCORD_TOKEN);

/* =========================
   ROUTE TEST (GET /)
========================= */
app.get("/", (req, res) => {
  res.send("OK");
});

/* =========================
   SHOPIFY HMAC CHECK
========================= */
function verifyShopify(req) {
  const hmac = req.get("X-Shopify-Hmac-Sha256");
  if (!hmac) return false;

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.body)
    .digest("base64");

  return crypto.timingSafeEqual(
    Buffer.from(digest),
    Buffer.from(hmac)
  );
}

/* =========================
   RÉCUPÉRATION ID JOUEUR
========================= */
function getPlayerId(order) {
  for (const item of order.line_items || []) {
    for (const prop of item.properties || []) {
      const name = (prop.name || "").toLowerCase();
      if (name.includes("id du joueur") || name.includes("id joueur")) {
        return prop.value;
      }
    }
  }
  return "❌ Non renseigné";
}

/* =========================
   WEBHOOK SHOPIFY
========================= */
app.post("/shopify", async (req, res) => {
  console.log("📩 Webhook Shopify reçu");

  if (!verifyShopify(req)) {
    console.log("❌ HMAC Shopify invalide");
    return res.status(401).send("Invalid HMAC");
  }

  console.log("✅ HMAC Shopify valide");

  try {
    const order = JSON.parse(req.body.toString("utf8"));

    const pack = order.line_items?.[0]?.title || "Pack";
    const playerId = getPlayerId(order);
    const orderNumber = order.order_number || order.name || "—";
    const email = order.email || "—";

    const channel = await client.channels.fetch(process.env.CHANNEL_ID);

    await channel.send(
      `✅ **Nouvelle inscription League Sekai**\n\n` +
      `🎮 **Pack** : ${pack}\n` +
      `🕹️ **ID joueur** : ${playerId}\n` +
      `📦 **Commande** : ${orderNumber}\n` +
      `📧 **Email** : ${email}`
    );

    console.log("📨 Message envoyé sur Discord");
    res.send("ok");

  } catch (err) {
    console.error("🔥 Erreur webhook :", err);
    res.status(500).send("Server error");
  }
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Serveur lancé sur le port ${PORT}`);
});
