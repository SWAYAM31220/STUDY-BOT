import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// ✅ Load environment variables
const {
  BOT_TOKEN,
  SUPABASE_URL,
  SUPABASE_KEY,
  CHAT_API_KEY,
  PORT = 3000
} = process.env;

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY || !CHAT_API_KEY) {
  console.error("❌ Missing environment variables. Please check your .env file.");
  process.exit(1);
}

// ✅ Initialize Supabase and Bot
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new Telegraf(BOT_TOKEN);

// 📡 Express Keep-Alive Server
const app = express();
app.get('/', (req, res) => res.send('🚀 Bot is alive and running.'));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// 📌 /start command with all commands usage
bot.start((ctx) => {
  const startMessage = `
👋 **Welcome to the School Bot!**

Here are the commands you can use:

1️⃣ **/add <first_name> <class> <age>**
   - Save a new member
   - Example: /add Swayam BTECH 18

2️⃣ **/tag <class>**
   - Tag all members of a specific class
   - Example: /tag BTECH

3️⃣ **/explain <topic> <word_limit>**
   - Get a school-level explanation of a topic
   - Example: /explain Photosynthesis 50
   - Word limit must be 10-1000

📝 Notes:
- All inputs are validated
- Mentions are sent in chunks of 50 users to avoid message limits
- Explanations are saved to the database automatically
`;

  ctx.reply(startMessage, { parse_mode: 'Markdown' });
});

// 📌 /add command
bot.command('add', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);

    if (args.length !== 3) {
      return ctx.reply("⚠️ Usage: `/add <first_name> <class> <age>`\nExample: `/add Swayam BTECH 18`", { parse_mode: "Markdown" });
    }

    const [first_name, className, ageStr] = args;

    if (!/^[A-Za-z]+$/.test(first_name)) {
      return ctx.reply("❌ First name must contain only alphabets. Example: `Swayam`");
    }
    if (!className.trim()) {
      return ctx.reply("❌ Class cannot be empty. Example: `BTECH`");
    }

    const age = parseInt(ageStr, 10);
    if (isNaN(age) || age < 5 || age > 120) {
      return ctx.reply("❌ Age must be a number between 5 and 120. Example: `18`");
    }

    const { data, error } = await supabase
      .from('members')
      .insert([{ first_name, class: className, age, added_by: ctx.from.id }])
      .select('id')
      .single();

    if (error) {
      console.error("❌ Supabase insert error:", error);
      return ctx.reply("⚠️ Database insert failed. Try again later.");
    }

    return ctx.reply(
      `✅ **Member added successfully!**\n\n🆔 ID: \`${data.id}\`\n👤 Name: ${first_name}\n🏫 Class: ${className}\n🎂 Age: ${age}\n📥 Added by: ${ctx.from.first_name}`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("❌ Unexpected Error:", err);
    ctx.reply("⚠️ Unexpected error occurred. Check logs.");
  }
});

// 📌 /tag command
bot.command('tag', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 1) return ctx.reply("⚠️ Usage: `/tag <class>`\nExample: `/tag BTECH`", { parse_mode: "Markdown" });

    const className = args[0].trim();
    if (!className) return ctx.reply("⚠️ Class cannot be empty!\nUsage: `/tag <class>`", { parse_mode: "Markdown" });

    const { data: members, error } = await supabase
      .from('members')
      .select('added_by, first_name')
      .ilike('class', className);

    if (error) {
      console.error("❌ Supabase query error:", error);
      return ctx.reply("⚠️ DB query failed. Try again later.");
    }

    if (!members || members.length === 0) {
      return ctx.reply(`❌ No members found in class ${className}!`);
    }

    const userMentions = members.map(m => `[${m.first_name}](tg://user?id=${m.added_by})`);
    const chunkSize = 50;
    for (let i = 0; i < userMentions.length; i += chunkSize) {
      const chunk = userMentions.slice(i, i + chunkSize).join(' ');
      await ctx.reply(`📢 ${className} Members:\n${chunk}`, { parse_mode: "Markdown" });
    }
  } catch (err) {
    console.error("❌ /tag unexpected error:", err);
    ctx.reply("⚠️ Unexpected error occurred. Check logs.");
  }
});

// 📌 /explain command
bot.command('explain', async (ctx) => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) return ctx.reply("⚠️ Usage: /explain <topic> <word_limit>");

    const wordLimitStr = args[args.length - 1];
    const topic = args.slice(0, args.length - 1).join(" ").trim();
    const wordLimit = parseInt(wordLimitStr, 10);

    if (!topic || isNaN(wordLimit) || wordLimit < 10 || wordLimit > 1000) {
      return ctx.reply("⚠️ Topic cannot be empty & word limit must be 10-1000");
    }

    const max_tokens = Math.ceil(wordLimit * 1.33);
    const prompt = `Explain ${topic} in ${wordLimit} words in simple, school-level language, avoid high-level words, Hinglish/English mix allowed.`;

    const apiResponse = await axios.post(
      "https://api.chatanywhere.tech/v1/chat/completions",
      { model: "gpt-3.5-turbo", messages: [{ role: "user", content: prompt }], max_tokens },
      { headers: { Authorization: `Bearer ${CHAT_API_KEY}`, "Content-Type": "application/json" } }
    );

    let explanation = apiResponse.data?.choices?.[0]?.message?.content || "No explanation found.";
    explanation = explanation.split(/\s+/).slice(0, wordLimit).join(" ");

    // Save to Supabase
    try {
      const { error } = await supabase.from("explanations").insert([{ topic, word_limit: wordLimit, user_id: ctx.from.id, response: explanation }]);
      if (error) console.error("Supabase insert failed:", error);
    } catch (supErr) {
      console.error("Supabase insert failed:", supErr);
    }

    ctx.reply(`🧠 Topic: ${topic}\n📝 Explanation (${wordLimit} words):\n${explanation}`);
  } catch (err) {
    console.error("/explain error:", err.response?.data || err.message);
    ctx.reply("❌ Could not generate explanation. Try again later.");
  }
});

// 🚀 Launch bot
bot.launch().then(() => console.log("🤖 Telegram bot is running..."));

// 🛑 Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
