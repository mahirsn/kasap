# Kasap - Archive Management Bot

Discord bot for managing archive channels with ownership, permissions, and logging. Built with discord.js v14 and TypeScript.

## Setup

1. **Clone and install:**
   ```bash
   git clone https://github.com/mahirsn/Kasap.git
   cd Kasap
   npm install
   ```

2. **Configure:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set `BOT_TOKEN` and `GUILD_ID`.

3. **Build and run:**
   ```bash
   npm run build
   npm start
   ```

4. **In Discord:** Use `/setup` in any channel to deploy the archive creation panel.

## Run as Service (Ubuntu)

```bash
sudo cp archive-bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable archive-bot
sudo systemctl start archive-bot
```

Logs: `sudo journalctl -u archive-bot -f`
