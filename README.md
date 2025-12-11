# Node.js Backend for React Chatbot

A complete Node.js/Express backend that replicates all Flask functionality for the Women Entrepreneurship Support chatbot.

## Features

- RESTful API with Express
- Session management with node-cache
- Natural Language Processing with natural & compromise
- AI integration (Groq, OpenAI, Google AI)
- Geocoding & location services
- Multi-language support
- Intent detection & entity extraction

## Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` and add your API keys:
```
GROQ_API_KEY=your_groq_key
OPENAI_API_KEY=your_openai_key
GOOGLE_AI_API_KEY=your_google_key
```

### 3. Start Server
```bash
npm start
# or for development with auto-reload
npm run dev
```

Server runs on `http://localhost:5000`

## API Endpoints

### Chat Endpoints
- `POST /api/chat` - Send chat message
- `POST /api/button_click` - Handle button clicks
- `POST /api/select_idea` - Select business idea

### Location Endpoints
- `POST /api/location/detect` - Detect location from coordinates
- `POST /api/location/nearby` - Search nearby businesses
- `POST /api/location/analyze` - Analyze location for business

### Business Endpoints
- `POST /api/business/qa` - Ask business questions

### Health Check
- `GET /health` - Server health status

## Project Structure

```
backend/
├── server.js              # Main server file
├── routes/
│   ├── chat.js           # Chat endpoints
│   ├── location.js       # Location endpoints
│   └── business.js       # Business Q&A
├── services/
│   ├── llmService.js     # AI/LLM integration
│   └── geocodingService.js # Geocoding & maps
├── utils/
│   ├── sessionManager.js # Session handling
│   ├── intentDetector.js # NLP & intent detection
│   └── translations.js   # Multi-language support
├── package.json
└── .env.example
```

## Technologies

- **Express** - Web framework
- **natural** - NLP library
- **compromise** - Text processing
- **node-cache** - Session storage
- **groq-sdk** - Groq AI
- **openai** - OpenAI API
- **@google/generative-ai** - Google AI
- **axios** - HTTP client

## Usage

The backend works seamlessly with the React frontend. No code changes needed in the React app - just point it to this backend URL.

## Development

```bash
npm run dev  # Start with nodemon for auto-reload
```

## Production

```bash
npm start
```

For production deployment, consider:
- Using PM2 for process management
- Setting up HTTPS
- Using a proper database instead of node-cache
- Adding rate limiting
- Implementing proper authentication
