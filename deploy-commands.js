import { REST, Routes, SlashCommandBuilder } from "discord.js";
import "dotenv/config";

const commands = [
  new SlashCommandBuilder()
    .setName("draft")
    .setDescription("Avvia il draft: nome + logo alleanza")
    .addStringOption(opt => opt.setName("nome").setDescription("Nome comandante").setRequired(true))
    .addStringOption(opt => opt.setName("logo").setDescription("URL logo (png/jpg/webp)").setRequired(true)),

  new SlashCommandBuilder()
    .setName("join")
    .setDescription("Il secondo comandante entra: nome + logo")
    .addStringOption(opt => opt.setName("nome").setDescription("Nome comandante").setRequired(true))
    .addStringOption(opt => opt.setName("logo").setDescription("URL logo (png/jpg/webp)").setRequired(true)),

  new SlashCommandBuilder()
    .setName("pick")
    .setDescription("Scegli una nazione")
    .addStringOption(opt => opt.setName("nazione").setDescription("Nome della nazione").setRequired(true)),

  new SlashCommandBuilder()
    .setName("eroi")
    .setDescription("Rispondi alla domanda finale: eroi si/no")
    .addStringOption(opt => opt.setName("scelta").setDescription("si oppure no").setRequired(true)),

  new SlashCommandBuilder().setName("status").setDescription("Mostra lo stato del draft"),
  new SlashCommandBuilder().setName("reset").setDescription("Resetta la sessione nel canale")
].map(cmd => cmd.toJSON());

const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

async function main() {
  if (!process.env.CLIENT_ID || !process.env.TOKEN) {
    console.error("❌ CLIENT_ID o TOKEN mancanti nel .env");
    process.exit(1);
  }
  await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
  console.log("✅ Comandi slash registrati globalmente");
}
main().catch(console.error);
