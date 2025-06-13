# Tyangge 24/7 - Fabulous Telegram Bot 💅

A full-featured e-commerce Telegram bot with Filipino bakla personality for adult shop operations.

## Features 🌈

- **Admin Approval System**: New users require admin approval
- **Age Verification**: 18+ verification required
- **Product Categories**: Organized shopping experience
- **PIN System**: Secure access to restricted items
- **Cart Management**: Add, view, and manage cart items
- **Checkout Process**: Complete order flow with location sharing
- **Payment Integration**: Xendit payment gateway support
- **Order Tracking**: Real-time order status updates
- **Admin Tools**: Comprehensive admin management
- **VIP System**: Special privileges for VIP users

## Setup Instructions 🚀

### 1. Create Telegram Bot
1. Message @BotFather on Telegram
2. Use `/newbot` command
3. Follow instructions to create your bot
4. Save the bot token

### 2. Environment Variables
Copy `.env.example` to `.env` and fill in your values:

\`\`\`bash
TELEGRAM_BOT_TOKEN=your_bot_token
ADMIN_CHAT_ID=your_telegram_id
MONGODB_URI=your_mongodb_connection_string
XENDIT_API_KEY=your_xendit_api_key
WEBHOOK_URL=https://your-app.render.com
\`\`\`

### 3. Database Setup
- Create a MongoDB database (MongoDB Atlas recommended)
- The bot will automatically create collections on first run

### 4. Deploy to Render
1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set environment variables in Render dashboard
4. Deploy!

### 5. Set Webhook
The bot automatically sets the webhook URL when it starts.

## Bot Commands 📱

- `/start` - Begin the fabuloushkhhjy!

## Admin Features 👑

Admins can:
- Approve/deny new users
- Update order statuses
- Make users VIP
- Generate PINs for users
- View statistics
- Send payment links

## Product Categories 🛍️

1. **Cock Rings & Toys**
2. **Lubes & Condoms** 
3. **Performance Enhancers**
4. **Spicy Accessories**
5. **Essentials** (VIP/PIN required)

## Order Flow 📦

1. Browse products by category
2. Add items to cart
