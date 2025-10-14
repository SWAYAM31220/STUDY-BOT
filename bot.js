// ======================== IMPORTS ========================
import 'dotenv/config';
import express from 'express';
import { Telegraf } from 'telegraf';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

// ======================== ENVIRONMENT VARIABLES ========================
const { BOT_TOKEN, SUPABASE_URL, SUPABASE_KEY, CHAT_API_KEY, PORT = 3000 } = process.env;

if (!BOT_TOKEN || !SUPABASE_URL || !SUPABASE_KEY || !CHAT_API_KEY) {
  console.error("❌ Missing environment variables. Check your .env file!");
  process.exit(1);
}

// ======================== INITIALIZE ========================
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const bot = new Telegraf(BOT_TOKEN);

// ======================== EXPRESS KEEP-ALIVE SERVER ========================
const app = express();
app.get('/', (req, res) => res.send('🚀 Study Bot is alive and running.'));
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// ======================== /start ========================
bot.start((ctx) => {
  const startMsg = `
👋 Welcome to Study-Bot!

**Available Commands**
1️⃣ /add <first_name> <class> <age>
2️⃣ /tag <class>
3️⃣ /list — view all students in this channel
4️⃣ /explain <topic> <word_limit>
5️⃣ /alert everyone (admin only)

🧠 Channel-specific data: each group/channel has its own list.
`;
  ctx.reply(startMsg, { parse_mode: "Markdown" });
});

// ======================== /add ========================
bot.command('add', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 3) return ctx.reply("⚠️ Usage: `/add <first_name> <class> <age>`", { parse_mode: "Markdown" });

    const [first_name, className, ageStr] = args;
    const age = parseInt(ageStr, 10);
    const chat_id = ctx.chat.id;

    if (!/^[A-Za-z]+$/.test(first_name)) return ctx.reply("❌ First name must be letters only.");
    if (!className.trim()) return ctx.reply("❌ Class cannot be empty.");
    if (isNaN(age) || age < 5 || age > 120) return ctx.reply("❌ Age must be between 5–120.");

    const { data, error } = await supabase
      .from('members')
      .insert([{ chat_id, first_name, class: className, age, added_by: ctx.from.id }])
      .select('id')
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return ctx.reply("⚠️ Could not save member. Try again later.");
    }

    ctx.reply(`✅ Member added successfully!
🏫 Channel ID: ${chat_id}
👤 ${first_name}
🎓 ${className}
🎂 ${age}`);
  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ Unexpected error occurred.");
  }
});

// ======================== /tag ========================
bot.command('tag', async (ctx) => {
  try {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length !== 1) return ctx.reply("⚠️ Usage: `/tag <class>`", { parse_mode: "Markdown" });
    const className = args[0].trim();

    const { data: members, error } = await supabase
      .from('members')
      .select('added_by, first_name')
      .eq('chat_id', ctx.chat.id)
      .ilike('class', className);

    if (error) {
      console.error("Supabase fetch error:", error);
      return ctx.reply("⚠️ Database query failed.");
    }

    if (!members || members.length === 0)
      return ctx.reply(`❌ No members found for class *${className}* in this channel.`, { parse_mode: "Markdown" });

    const mentions = members.map(m => `[${m.first_name}](tg://user?id=${m.added_by})`);
    const chunkSize = 50;
    for (let i = 0; i < mentions.length; i += chunkSize) {
      const chunk = mentions.slice(i, i + chunkSize).join(' ');
      await ctx.reply(`📢 *${className}* members:\n${chunk}`, { parse_mode: "Markdown" });
    }
  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ Unexpected error.");
  }
});

// ======================== /list ========================
bot.command('list', async (ctx) => {
  try {
    const { data: members, error } = await supabase
      .from('members')
      .select('first_name, class, age')
      .eq('chat_id', ctx.chat.id);

    if (error) return ctx.reply("⚠️ Could not fetch list.");
    if (!members.length) return ctx.reply("📭 No members added yet for this channel.");

    const list = members.map(m => `👤 ${m.first_name} | 🎓 ${m.class} | 🎂 ${m.age}`).join('\n');
    ctx.reply(`📋 *Members in ${ctx.chat.title || "this channel"}:*\n\n${list}`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error(err);
    ctx.reply("⚠️ Error fetching list.");
  }
});

// ======================== /explain ========================
bot.command('explain', async (ctx) => {
  try {
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length < 2) return ctx.reply("⚠️ Usage: /explain <topic> <word_limit>");

    const wordLimitStr = args[args.length - 1];
    const topic = args.slice(0, args.length - 1).join(" ").trim();
    const wordLimit = parseInt(wordLimitStr, 10);

    if (!topic || isNaN(wordLimit) || wordLimit < 10 || wordLimit > 1000)
      return ctx.reply("⚠️ Topic cannot be empty & word limit must be 10–1000");

    const max_tokens = Math.ceil(wordLimit * 1.33);
    const prompt = `Explain ${topic} in ${wordLimit} words in simple school-level language. Avoid complex terms; Hinglish/English mix allowed.`;

    const apiResponse = await axios.post(
      "https://api.chatanywhere.tech/v1/chat/completions",
      { model: "gpt-3.5-turbo", messages: [{ role: "user", content: prompt }], max_tokens },
      { headers: { Authorization: `Bearer ${CHAT_API_KEY}`, "Content-Type": "application/json" } }
    );

    let explanation = apiResponse.data?.choices?.[0]?.message?.content || "No explanation found.";
    explanation = explanation.split(/\s+/).slice(0, wordLimit).join(" ");

    await supabase.from("explanations").insert([
      { topic, word_limit: wordLimit, user_id: ctx.from.id, chat_id: ctx.chat.id, response: explanation }
    ]);

    ctx.reply(`🧠 *Topic:* ${topic}\n📝 *Explanation (${wordLimit} words):*\n${explanation}`, { parse_mode: "Markdown" });
  } catch (err) {
    console.error(err.response?.data || err.message);
    ctx.reply("❌ Could not generate explanation. Try again later.");
  }
});

// ======================== /alert everyone ========================
bot.command('alert', async (ctx) => {
  try {
    if (!ctx.message.text.includes("everyone")) return;

    const chatMember = await ctx.getChatMember(ctx.from.id);
    if (!["creator", "administrator"].includes(chatMember.status))
      return ctx.reply("❌ Only admins can use /alert everyone!");

    const chat_id = ctx.chat.id;

    const { data: savedMembers } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("chat_id", chat_id);

    if (!savedMembers || savedMembers.length === 0)
      return ctx.reply("❌ No members saved for this group in Supabase!");

    const chunkSize = 50;
    for (let i = 0; i < savedMembers.length; i += chunkSize) {
      const chunk = savedMembers
        .slice(i, i + chunkSize)
        .map(m => `[🔥](tg://user?id=${m.user_id})`)
        .join(' ');
      await ctx.reply(`📢 Alert everyone:\n${chunk}`, { parse_mode: "Markdown" });
    }
  } catch (err) {
    console.error("/alert error:", err);
    ctx.reply("⚠️ Could not send alert.");
  }
});

// ======================== BOT LAUNCH ========================
bot.launch().then(() => console.log("🤖 Study Bot is running..."));
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
