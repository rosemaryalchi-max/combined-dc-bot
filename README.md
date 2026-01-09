# Antigravity Bot 🚀

A powerful, all-in-one Discord bot designed for communities, featuring high-quality music, advanced security, economy games, and a modern "Antigravity Cockpit" for easy administration.

## ✨ Features

### 🎵 High-Quality Music
- Play music from **YouTube, Spotify, and SoundCloud**.
- **Commands**: `/play`, `/pause`, `/skip`, `/queue`, `/stop`.
- **Filters**: Bassboost, Nightcore, Vaporwave, and more.
- **Smart Queue**: Drag & drop queue management (coming soon).

### 🛡️ Security & Moderation
- **Panic Mode**: Instantly lock down the server in case of a raid.
- **Verification System**: CAPTCHA-based verification with role assignment.
- **Auto-Mod**: Log deleted messages, member kicks/bans to a dedicated `#mod-logs` channel.
- **Backup**: Role and Channel backup system.

### 📩 Advanced Ticket System
- One-click ticket creation.
- Private channels for support.
- **Transcripts**: Automatically saves chat logs when a ticket is closed.
- Configurable support roles and welcome messages.

### 💰 Economy & Crypto
- **Crypto Prediction**: Guess the price of BTC/ETH and win rewards.
- **Faucet**: Claim testnet tokens (Base/Sepolia) directly from Discord.
- **Daily Rewards**: `/daily` streak system.
- **User Stats**: Track messages, voice time, and game wins.

### 🎛️ The Antigravity Cockpit (Admin Panel)
- Forget memorizing complex config commands.
- Run **/setup** once to spawn the **Admin Control Panel**.
- Configure EVERYTHING (Channels, Music Restrictions, Security) from a persistent, interactive UI.

---

## 🛠️ Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/your-username/antigravity-bot.git
    cd antigravity-bot
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Configure Environment**:
    Create a `.env` file in the root directory (see `.env.example`).

    ```env
    # Discord Keys
    DISCORD_TOKEN=your_bot_token
    CLIENT_ID=your_client_id
    GUILD_ID=your_guild_id (optional, for dev)

    # Database / Config
    GLOBAL_COMMANDS=true
    
    # Music (Optional)
    SPOTIFY_CLIENT_ID=...
    SPOTIFY_CLIENT_SECRET=...
    YT_COOKIE=...

    # Economy / Crypto (Optional)
    GIVEAWAY_CAP_BASE=10
    ```

4.  **Deploy Commands**:
    ```bash
    node deploy-commands.js
    ```

5.  **Start the Bot**:
    ```bash
    node index.js
    ```

---

## 🚀 Getting Started

### 1. Initialize the Cockpit
The first thing you should do is set up the admin panel.
- Run: ` /setup `
- A private channel `#admin-config` will be created.
- Use the **Dropdown Menu** in that channel to configure:
    - **Log Channels**
    - **Music Restrictions** (Voice Channel only? Specific channel?)
    - **Panic Mode**

### 2. Create Public Panels
Use the **Tools** category in the Cockpit to spawn interactive buttons in your public channels:
- **Verification Panel**: Let users verify themselves.
- **Ticket Panel**: Let users open support tickets.

---

## 🤝 Contributing
Contributions are welcome! Please fork the repository and submit a pull request.

## 📄 License
This project is licensed under the MIT License.
