import "dotenv/config";
import { Client, GatewayIntentBits, EmbedBuilder, Colors, Partials } from "discord.js";

const ALL_NATIONS = [
  "Germania","Austria","Francia","Russia","Impero Ottomano",
  "Italia","Spagna","Marocco","Inghilterra","Svezia","Portogallo",
  "Paesi Bassi","Belgio","Norvegia","Finlandia","Polonia","Romania","Grecia","Bulgaria","Serbia"
];
const FLAGS = {
  "Germania":"🇩🇪","Austria":"🇦🇹","Francia":"🇫🇷","Russia":"🇷🇺","Impero Ottomano":"🇹🇷",
  "Italia":"🇮🇹","Spagna":"🇪🇸","Marocco":"🇲🇦","Inghilterra":"🇬🇧","Svezia":"🇸🇪",
  "Portogallo":"🇵🇹","Paesi Bassi":"🇳🇱","Belgio":"🇧🇪","Norvegia":"🇳🇴","Finlandia":"🇫🇮",
  "Polonia":"🇵🇱","Romania":"🇷🇴","Grecia":"🇬🇷","Bulgaria":"🇧🇬","Serbia":"🇷🇸"
};

const normalize = (s) => s.trim().toLowerCase();
const fmtChoices = (arr) => (arr.length ? arr.map(n => `${FLAGS[n] ?? "🏳️"} ${n}`).join(", ") : "—");
const TIMER_SECONDS = 30 * 60;

const rooms = new Map();

function newRoom(channelId) {
  return {
    channelId,
    phase: "idle",
    available: [...ALL_NATIONS],
    players: [
      { name: null, logo: null, picks: [], heroes: null },
      { name: null, logo: null, picks: [], heroes: null }
    ],
    currentTurn: 0,
    picksThisTurn: 0,
    picksTargetThisTurn: 1,
    timer: { timeLeft: 0, interval: null },
    lastEmbedMessageId: null
  };
}
function ensureRoom(channelId) {
  if (!rooms.has(channelId)) rooms.set(channelId, newRoom(channelId));
  return rooms.get(channelId);
}
function stopTimer(room) {
  if (room.timer.interval) {
    clearInterval(room.timer.interval);
    room.timer.interval = null;
  }
}
async function resetTimer(room, channel) {
  stopTimer(room);
  room.timer.timeLeft = TIMER_SECONDS;
  room.timer.interval = setInterval(async () => {
    room.timer.timeLeft--;
    if (room.timer.timeLeft < 0) {
      await channel.send({ content: "⏰ Tempo scaduto! Il turno passa all'altro comandante." });
      advanceTurn(room, channel, false);
      await renderState(room, channel);
      await resetTimer(room, channel);
    } else {
      await renderState(room, channel);
    }
  }, 1000);
}
function advanceTurn(room, channel, announce = true) {
  room.picksThisTurn = 0;
  room.picksTargetThisTurn = 2;
  room.currentTurn = 1 - room.currentTurn;
  if (announce && room.players[room.currentTurn].name) {
    channel.send({ content: `➡️ Tocca a ${room.players[room.currentTurn].name}` });
  }
}
function isDraftComplete(room) {
  return room.players[0].picks.length >= 5 && room.players[1].picks.length >= 5;
}

function buildEmbed(room) {
  const p0 = room.players[0];
  const p1 = room.players[1];

  const min = Math.max(0, Math.floor(room.timer.timeLeft / 60));
  const sec = Math.max(0, room.timer.timeLeft % 60);
  const timerStr = room.phase === "drafting" ? `⏱ ${String(min)}m ${String(sec).padStart(2,"0")}s` : "—";

  const embed = new EmbedBuilder()
    .setTitle("🎯 Draft AvA Sup")
    .setColor(Colors.Blurple)
    .addFields(
      { name: "Comandanti", value: `${p0.name ?? "—"} vs ${p1.name ?? "—"}` },
      { name: "Turno", value: room.phase === "drafting" ? (room.players[room.currentTurn].name ?? "—") : (room.phase === "heroes" ? "Domanda: Eroi sì / Eroi no" : room.phase) },
      { name: "Timer", value: timerStr }
    );

  if (p0.logo) embed.setThumbnail(p0.logo);
  if (p1.logo) embed.setImage(p1.logo);

  embed.addFields(
    { name: p0.name ?? "Comandante 1", value: fmtChoices(p0.picks), inline: true },
    { name: p1.name ?? "Comandante 2", value: fmtChoices(p1.picks), inline: true }
  );

  if (room.phase === "heroes") {
    const h0 = p0.heroes == null ? "—" : (p0.heroes ? "Sì" : "No");
    const h1 = p1.heroes == null ? "—" : (p1.heroes ? "Sì" : "No");
    embed.addFields({ name: "Eroi", value: `• ${p0.name}: ${h0}\n• ${p1.name}: ${h1}` });
  }

  const preview = room.available.slice(0, 10).map(n => `${FLAGS[n] ?? "🏳️"} ${n}`).join(" • ");
  embed.addFields({ name: "Disponibili (prime 10)", value: preview || "—" });

  return embed;
}

async function renderState(room, channel) {
  const embed = buildEmbed(room);
  try {
    if (room.lastEmbedMessageId) {
      const msg = await channel.messages.fetch(room.lastEmbedMessageId).catch(() => null);
      if (msg) {
        await msg.edit({ embeds: [embed] });
        return;
      }
    }
    const sent = await channel.send({ embeds: [embed] });
    room.lastEmbedMessageId = sent.id;
  } catch {
    const sent = await channel.send({ embeds: [embed] });
    room.lastEmbedMessageId = sent.id;
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  partials: [Partials.Channel]
});

client.once("ready", () => {
  console.log(`✅ Bot online come ${client.user.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const channel = interaction.channel;
  const room = ensureRoom(channel.id);

  const isUrl = (u) => /^https?:\/\/\S+\.(png|jpg|jpeg|gif|webp)(\?\S*)?$/i.test(u);

  switch (interaction.commandName) {
    case "reset": {
      rooms.set(channel.id, newRoom(channel.id));
      stopTimer(room);
      await interaction.reply({ content: "🔄 Reset effettuato. Usa /draft per avviare un nuovo draft.", ephemeral: false });
      await renderState(rooms.get(channel.id), channel);
      break;
    }

    case "status": {
      await interaction.deferReply({ ephemeral: false });
      await renderState(room, channel);
      await interaction.editReply({ content: "📊 Stato aggiornato." });
      break;
    }

    case "draft": {
      const name = interaction.options.getString("nome", true).trim();
      const logo = interaction.options.getString("logo", true).trim();
      if (!isUrl(logo)) {
        await interaction.reply({ content: "❌ Il logo deve essere un URL diretto a un'immagine (png/jpg/webp).", ephemeral: true });
        return;
      }

      room.phase = "waiting";
      room.players[0].name = name;
      room.players[0].logo = logo;
      room.players[0].picks = [];
      room.players[1].picks = [];
      room.players[0].heroes = null;
      room.players[1].heroes = null;
      room.available = [...ALL_NATIONS];
      room.currentTurn = 0;
      room.picksThisTurn = 0;
      room.picksTargetThisTurn = 1;
      stopTimer(room);

      await interaction.reply({ content: `🚀 Draft avviato da ${name}. In attesa del secondo comandante con /join.`, ephemeral: false });
      await renderState(room, channel);
      break;
    }

    case "join": {
      if (room.phase !== "waiting") {
        await interaction.reply({ content: "❌ Non c'è un draft in attesa. Usa /draft per iniziare.", ephemeral: true });
        return;
      }
      const name = interaction.options.getString("nome", true).trim();
      const logo = interaction.options.getString("logo", true).trim();
      if (!isUrl(logo)) {
        await interaction.reply({ content: "❌ Il logo deve essere un URL diretto a un'immagine (png/jpg/webp).", ephemeral: true });
        return;
      }
      room.players[1].name = name;
      room.players[1].logo = logo;
      room.phase = "drafting";
      room.currentTurn = 0;
      room.picksThisTurn = 0;
      room.picksTargetThisTurn = 1;

      await interaction.reply({ content: `➕ ${name} si è unito! Tocca a ${room.players[room.currentTurn].name}.`, ephemeral: false });
      await renderState(room, channel);
      await resetTimer(room, channel);
      break;
    }

    case "pick": {
      if (room.phase !== "drafting") {
        await interaction.reply({ content: "❌ Non siamo in fase di draft. Avvia con /draft e /join.", ephemeral: true });
        return;
      }
      if (!room.players[0].name || !room.players[1].name) {
        await interaction.reply({ content: "❌ Servono due comandanti. Usa /join per entrare.", ephemeral: true });
        return;
      }

      const nationInput = interaction.options.getString("nazione", true).trim();
      const matchNation = room.available.find(n => normalize(n) === normalize(nationInput));
      if (!matchNation) {
        await interaction.reply({ content: `❌ “${nationInput}” non è disponibile o già scelta.`, ephemeral: true });
        return;
      }

      const turnName = room.players[room.currentTurn].name;
      const authorDisplay = interaction.member?.nickname || interaction.user.username;
      if (normalize(authorDisplay) !== normalize(turnName)) {
        await interaction.reply({ content: `ℹ️ Il turno è di ${turnName}.`, ephemeral: true });
        return;
      }

      if (room.players[room.currentTurn].picks.length >= 5) {
        await interaction.reply({ content: `❌ ${turnName} ha già scelto 5 nazioni.`, ephemeral: true });
        return;
      }

      room.players[room.currentTurn].picks.push(matchNation);
      room.available = room.available.filter(n => n !== matchNation);
      room.picksThisTurn++;

      await interaction.reply({ content: `✅ ${turnName} ha scelto ${FLAGS[matchNation] ?? "🏳️"} ${matchNation}`, ephemeral: false });
      await renderState(room, channel);
      await resetTimer(room, channel);

      if (isDraftComplete(room)) {
        room.phase = "heroes";
        stopTimer(room);
        await channel.send("🛡️ Draft completato. Domanda obbligatoria: “Eroi sì” oppure “Eroi no”. Ciascun comandante risponda con: /eroi scelta: si oppure no");
        await renderState(room, channel);
        return;
      }

      if (room.picksThisTurn >= room.picksTargetThisTurn) {
        if (room.picksTargetThisTurn === 1) room.picksTargetThisTurn = 2;
        advanceTurn(room, channel, true);
        await renderState(room, channel);
      }
      break;
    }

    case "eroi": {
      if (room.phase !== "heroes") {
        await interaction.reply({ content: "❌ Non siamo in fase “Eroi”. Completa prima il draft.", ephemeral: true });
        return;
      }
      const choice = (interaction.options.getString("scelta", true) || "").toLowerCase();
      if (!["si","no"].includes(choice)) {
        await interaction.reply({ content: "❌ Usa: scelta = si oppure no", ephemeral: true });
        return;
      }
      const authorDisplay = interaction.member?.nickname || interaction.user.username;
      const idx = [room.players[0].name, room.players[1].name].findIndex(n => normalize(n) === normalize(authorDisplay));
      if (idx === -1) {
        await interaction.reply({ content: "❌ Solo i due comandanti possono rispondere alla domanda “Eroi”.", ephemeral: true });
        return;
      }

      room.players[idx].heroes = choice === "si";
      await interaction.reply({ content: `📝 ${room.players[idx].name} ha risposto: Eroi ${choice.toUpperCase()}.`, ephemeral: false });
      await renderState(room, channel);

      if (room.players[0].heroes != null && room.players[1].heroes != null) {
        room.phase = "done";
        stopTimer(room);

        const finalEmbed = new EmbedBuilder()
          .setTitle("✅ Riepilogo definitivo — Draft AvA Sup")
          .setColor(Colors.Green)
          .addFields(
            { name: room.players[0].name, value: fmtChoices(room.players[0].picks), inline: true },
            { name: room.players[1].name, value: fmtChoices(room.players[1].picks), inline: true },
            { name: "Eroi", value: `• ${room.players[0].name}: ${room.players[0].heroes ? "Sì" : "No"}\n• ${room.players[1].name}: ${room.players[1].heroes ? "Sì" : "No"}` }
          );
        if (room.players[0].logo) finalEmbed.setThumbnail(room.players[0].logo);
        if (room.players[1].logo) finalEmbed.setImage(room.players[1].logo);

        await channel.send({ embeds: [finalEmbed] });
        await channel.send("🎉 Draft concluso. Usa /reset per iniziare una nuova sessione in questo canale.");
      }
      break;
    }

    default:
      await interaction.reply({ content: "❔ Comando non riconosciuto. Usa /status.", ephemeral: true });
  }
});

client.login(process.env.TOKEN);
