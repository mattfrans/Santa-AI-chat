# AI Santa Chat 🎅

A modern web application that lets users chat with an AI-powered Santa Claus. Built with React, Express, and TypeScript.

## Features

- Interactive chat interface with AI Santa
- Modern, accessible UI components
- Real-time responses
- Type-safe backend and database operations

## Tech Stack

- **Frontend**:
  - React with TypeScript
  - Vite for build tooling
  - Radix UI components with Shadcn theme
  - TailwindCSS for styling
  - React Query for data fetching

- **Backend**:
  - Express.js with TypeScript
  - Drizzle ORM for database operations
  - Authentication system

## Getting Started

### Prerequisites

- Node.js (Latest LTS version recommended)
- npm or yarn package manager

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

### Development

To run the development server:
```bash
npm run dev
```

This will start both the frontend and backend in development mode.

### Building for Production

To create a production build:
```bash
npm run build
```

To start the production server:
```bash
npm start
```

## Project Structure

```
.
├── client/             # Frontend React application
├── server/             # Backend Express application
│   ├── auth.ts        # Authentication logic
│   ├── routes.ts      # API routes
│   └── index.ts       # Server entry point
├── db/                 # Database configuration and migrations
└── package.json       # Project dependencies and scripts
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes

## Contributing

This project was created on Replit and follows modern web development practices. Contributions are welcome!

## License

MIT
