# Archive Management Bot

Discord bot for managing archive channels with ownership, permissions, and logging.

## Setup

1. **Clone and install dependencies:**
   ```bash
   git clone <repo-url> /opt/archive-bot
   cd /opt/archive-bot
   pip3 install -r requirements.txt
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   nano .env
   ```
   Set `BOT_TOKEN` and `GUILD_ID`.

3. **Create required Discord channels:**
   - `#create-archive` — where the creation panel lives
   - `#archive-logs` — where actions are logged

4. **Run:**
   ```bash
   python3 main.py
   ```

5. **Send the panel:** Use `/setup-panel` in Discord (admin only).

## Run as a Service (Ubuntu)

```bash
sudo cp archive_bot.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable archive-bot
sudo systemctl start archive-bot
```

Logs:
```bash
sudo journalctl -u archive-bot -f
```
