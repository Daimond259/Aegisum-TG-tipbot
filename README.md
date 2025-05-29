# Aegisum Telegram Tip Bot

A comprehensive, non-custodial Telegram wallet and tip bot supporting multiple Layer-1 cryptocurrencies including AEGS, SHIC, PEPE, and ADVC.

## 🌟 Features

### 💰 Multi-Coin Wallet
- **Non-custodial**: Users control their own private keys
- **Multi-blockchain support**: AEGS, SHIC, PEPE, ADVC
- **HD wallet**: Hierarchical deterministic wallet generation
- **Secure encryption**: User passwords encrypt wallet seeds

### 🎁 Community Features
- **Tipping**: Send coins to other users instantly
- **Rain**: Distribute coins to recently active users
- **Airdrops**: Create timed airdrops with participant registration
- **Group management**: Admin-controlled group approval system

### 🔒 Security & Administration
- **Cooldown system**: Prevent spam with configurable cooldowns
- **Admin controls**: Set fees, manage groups, monitor status
- **Comprehensive logging**: Full audit trail of all activities
- **Rate limiting**: Built-in protection against abuse

### ⚡ Technical Features
- **Real-time monitoring**: Automatic blockchain synchronization
- **Background workers**: Efficient transaction processing
- **Database persistence**: SQLite database with full transaction history
- **Modular architecture**: Easy to add new cryptocurrencies

## 🚀 Quick Start

### Prerequisites
- Ubuntu 20.04+ server
- Node.js 16+
- Blockchain nodes for supported coins
- Telegram bot token

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/Daimond259/Aegisum-TG-tipbot.git
cd Aegisum-TG-tipbot
```

2. **Install dependencies:**
```bash
npm install
```

3. **Run setup wizard:**
```bash
npm run setup
```

4. **Start the bot:**
```bash
npm start
```

For detailed setup instructions, see [docs/SETUP.md](docs/SETUP.md).

## 📖 User Guide

### Wallet Commands
- `/start` - Create or restore your wallet
- `/balance` - Check your coin balances
- `/deposit` - Get your deposit addresses
- `/withdraw <coin> <amount> <address>` - Send coins to external address
- `/history` - View your transaction history

### Community Commands
- `/tip @username <coin> <amount>` - Tip another user
- `/rain <coin> <amount>` - Distribute coins to active users
- `/airdrop <coin> <amount> <minutes>` - Create a timed airdrop

### Example Usage
```
/tip @alice AEGS 10.5
/rain SHIC 100
/airdrop PEPE 500 5
/withdraw ADVC 25.0 AdvcAddress123...
```

## 🔧 Admin Guide

### Admin Commands
- `/status` - Check bot and blockchain status
- `/setgroups` - Approve the current group for bot usage
- `/setcooldown <seconds>` - Set command cooldown period
- `/setfees <coin> <fee>` - Configure transaction fees

### Group Management
1. Add the bot to your Telegram group
2. Use `/setgroups` as an admin to approve the group
3. Configure group-specific settings as needed

## 🏗️ Architecture

### Core Components
- **Database Layer**: SQLite with comprehensive schema
- **Blockchain Manager**: Multi-coin RPC interface
- **Wallet Manager**: Non-custodial wallet operations
- **Telegram Bot**: User interface and command handling
- **Background Workers**: Blockchain monitoring and airdrop management

### Supported Coins
| Coin | Symbol | Type | Status |
|------|--------|------|--------|
| Aegisum | AEGS | Layer-1 | ✅ Active |
| SHIC | SHIC | Layer-1 | ✅ Active |
| PEPE | PEPE | Layer-1 | ✅ Active |
| ADVC | ADVC | Layer-1 | ✅ Active |

## 🔐 Security

### Non-Custodial Design
- Users generate their own mnemonic seed phrases
- Private keys are encrypted with user passwords
- Bot never has access to unencrypted private keys
- Users can restore wallets independently

### Security Features
- AES encryption for sensitive data
- PBKDF2 key derivation
- Secure random number generation
- Input validation and sanitization
- Rate limiting and cooldowns

### Best Practices
- Regular backups of database
- Secure RPC credentials
- Firewall configuration
- Log monitoring
- Regular updates

## 🛠️ Development

### Project Structure
```
src/
├── bot/           # Telegram bot implementation
├── wallet/        # Wallet management
├── blockchain/    # Blockchain interfaces
├── database/      # Database models and schema
├── workers/       # Background tasks
└── utils/         # Utilities and helpers

config/            # Configuration files
docs/              # Documentation
scripts/           # Setup and maintenance scripts
```

### Adding New Coins

1. **Update supported coins list** in relevant files
2. **Add RPC configuration** to environment variables
3. **Configure address generation** in crypto utils
4. **Test blockchain connectivity**
5. **Update documentation**

### Running in Development
```bash
# Development mode with auto-restart
npm run dev

# Run workers separately
npm run worker

# Run tests
npm test
```

## 📊 Monitoring

### Health Checks
The bot provides comprehensive monitoring:
- Blockchain connection status
- Worker process health
- Database integrity
- Memory and performance metrics

### Logging
- Structured JSON logging
- Separate error and combined logs
- Log rotation and archival
- Real-time log monitoring

### Metrics
- User activity statistics
- Transaction volume
- Airdrop participation
- System performance

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

### Development Setup
```bash
git clone https://github.com/Daimond259/Aegisum-TG-tipbot.git
cd Aegisum-TG-tipbot
npm install
cp .env.example .env
# Configure your .env file
npm run dev
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Documentation
- [Complete Setup Guide](docs/SETUP.md)
- [API Documentation](docs/API.md)
- [Troubleshooting Guide](docs/TROUBLESHOOTING.md)

### Getting Help
1. Check the documentation first
2. Search existing GitHub issues
3. Create a new issue with detailed information
4. Join our community discussions

### Community
- **Telegram**: [Aegisum Community](https://t.me/aegisum)
- **Website**: [aegisum.com](https://aegisum.com)
- **GitHub**: [Issues and Discussions](https://github.com/Daimond259/Aegisum-TG-tipbot)

## 🙏 Acknowledgments

- Aegisum blockchain team
- Community contributors
- Open source libraries used
- Beta testers and early adopters

## ⚠️ Disclaimer

This software is provided "as is" without warranty. Users are responsible for:
- Securing their wallet passwords and seed phrases
- Understanding the risks of cryptocurrency
- Complying with local laws and regulations
- Regular backups and security practices

**Always test with small amounts first!**

---

Built with ❤️ for the Aegisum community