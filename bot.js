// bot.js
import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';

// ✅ Load environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing required environment variables. Check your .env file.");
  process.exit(1);
}

// ✅ Initialize Supabase and Bot
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new Telegraf(BOT_TOKEN);

// 📡 1. EXPRESS KEEP-ALIVE SERVER
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🚀 Bot is alive and running.');
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ✅ Start Express server
app.listen(PORT, () => {
  console.log(`🌐 Web server running on port ${PORT}`);
});

// 📌 /start command
bot.start((ctx) => {
  ctx.reply(
    "👋 **Welcome!**\nUse `/add <first_name> <class> <age>` to save a new member.\n\nExample:\n`/add Swayam BTECH 18`",
    { parse_mode: "Markdown" }
  );
});

// 📌 /add command
bot.command('add', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    // ✅ Validate argument count
    if (args.length !== 3) {
      return ctx.reply("⚠️ Invalid usage!\nUse: `/add <first_name> <class> <age>`\nExample: `/add Swayam BTECH 18`", { parse_mode: "Markdown" });
    }

    const [first_name, className, ageStr] = args;

    // ✅ Input validation
    if (!/^[A-Za-z]+$/.test(first_name)) {
      return ctx.reply("❌ First name me sirf alphabets hone chahiye. Example: `Swayam`");
    }
    if (!className.trim()) {
      return ctx.reply("❌ Class field empty mat chhodo. Example: `BTECH`");
    }

    const age = parseInt(ageStr, 10);
    if (isNaN(age) || age < 5 || age > 120) {
      return ctx.reply("❌ Age must be a number between 5 and 120. Example: `18`");
    }

    // ✅ Insert into Supabase
    const { data, error } = await supabase
      .from('members')
      .insert([
        {
          first_name,
          class: className,
          age,
          added_by: ctx.from.id
        }
      ])
      .select('id')
      .single();

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return ctx.reply("⚠️ Database insert failed. Try again later.");
    }

    // ✅ Success reply
    return ctx.reply(
      `✅ **Member added successfully!**\n\n🆔 ID: \`${data.id}\`\n👤 Name: ${first_name}\n🏫 Class: ${className}\n🎂 Age: ${age}\n📥 Added by: ${ctx.from.first_name}`,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error("❌ Unexpected Error:", err);
    ctx.reply("⚠️ Unexpected error occurred. Check logs.");
  }
});

// 🚀 Launch bot AFTER express starts
bot.launch().then(() => {
  console.log("🤖 Telegram bot is running...");
});

// 🛑 Graceful stop signals (Render-safe)
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
