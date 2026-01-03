import express from "express";
import crypto from "crypto";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(express.raw({ type: "application/json" }));

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function verifyShopify(req) {
  const hmac = req.get("X-Shopify-Hmac-Sha256");
  if (!hmac) return false;

  const digest = crypto
    .createHmac("sha256", process.env.SHOPIFY_WEBHOOK_SECRET)
    .update(req.body)
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmac));
}

function getPlayerId(order) {
  for (const item of order.line_items || []) {
    for (const prop of item.properties || []) {
      const n = (prop.name || "").toLowerCase();
      if (n.includes("id du joueur") || n.includes("id joueur")) {
        return prop.value;
      }
    }
  }
  return "❌ Non renseigné";
}

app.post("/shopify", async (req, res) => {
  if (!verifyShopify(req)) return res.status(401).send("Invalid HMAC");

  const order = JSON.parse(req.body.toString("utf8"));

  const pack = order.line_items?.[0]?.title || "Pack";
  const playerId = getPlayerId(order);
  const orderNumber = order.order_number || order.name;
  const email = order.email || "—";

  const channel = await client.channels.fetch(process.env.CHANNEL_ID);

  await channel.send(
    `✅ Nouvelle inscription League Sekai\n\n` +
    `🎮 Pack : ${pack}\n` +
    `🕹️ ID joueur : ${playerId}\n` +
    `📦 Commande : ${orderNumber}\n` +
    `📧 Email : ${email}`
  );

  res.send("ok");
});

client.once("ready", () => {
  console.log("🤖 Bot GameSekai connecté");
});

client.login(process.env.DISCORD_TOKEN);

app.listen(process.env.PORT || 3000);
