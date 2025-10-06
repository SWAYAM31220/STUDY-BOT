# 📦 RoastHim Member Bot (Telegraf + Supabase)

A simple Telegram bot that saves `/add` commands into a Supabase database. Perfect for student projects or managing group data.

---

## 🚀 Features

- ✅ Add members with `/add <first_name> <class> <age>`
- 🧠 Input validation (letters only, age range, etc.)
- 📦 Saves data into Supabase using `@supabase/supabase-js`
- 🪄 Replies with success + row ID
- 🐛 Error handling & console logging

---

## 📁 Setup Instructions

### 1️⃣ Clone and install dependencies:
```bash
npm install telegraf @supabase/supabase-js dotenv
