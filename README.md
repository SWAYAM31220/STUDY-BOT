# 🎓 School Bot – Telegram Bot

A **Telegram bot** for managing students, tagging classes, and generating school-level explanations of topics using **ChatAnywhere API**. Stores data in **Supabase**.  

---

## Features

- ✅ **Add members** with `/add <first_name> <class> <age>`  
- ✅ **Tag members by class** with `/tag <class>`  
- ✅ **Generate school-level explanations** using `/explain <topic> <word_limit>`  
- ✅ **Express server** for keep-alive and health checks  
- ✅ **Data storage** via Supabase  
- ✅ Fully configurable using **.env file**  

---

## Requirements

- Node.js v18+  
- NPM or Yarn  
- Telegram bot token ([@BotFather](https://t.me/BotFather))  
- Supabase project and API key  
- ChatAnywhere API key  

---

## Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/school-bot.git
cd school-bot
