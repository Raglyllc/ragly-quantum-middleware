# RAGLY Quantum Middleware

An interface to interact with the RAGLY AI, a conceptual quantum intelligence middleware for advanced knowledge discovery and problem-solving.

## Getting Started

### Prerequisites

You need a Google Gemini API key to run this application.

### Environment Variables

Create a `.env.local` file in the root directory and add:

\`\`\`env
NEXT_PUBLIC_GEMINI_API_KEY=your_api_key_here
\`\`\`

### Installation

\`\`\`bash
npm install
\`\`\`

### Development

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Deployment

Click the "Publish" button in v0 to deploy directly to Vercel, or:

1. Push your code to GitHub
2. Import the repository in Vercel
3. Add the `NEXT_PUBLIC_GEMINI_API_KEY` environment variable in Vercel project settings
4. Deploy

## Features

- Real-time streaming chat with Google Gemini AI
- Custom RAGLY QAI system instructions
- Markdown rendering with syntax highlighting
- Cyberpunk-inspired dark theme
- Responsive design
