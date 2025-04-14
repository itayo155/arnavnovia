import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config';
import { testConnection } from './config/db';
import authRoutes from './routes/authRoutes';
import tokenRoutes from './routes/tokenRoutes';
import { globalErrorHandler } from './utils/errorHandler';

// Create Express app
const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:3001',
    'https://arnavnovia.com',
    'https://api.arnavnovia.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Logging in development mode
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
  console.log('Server running in development mode on port', config.port);
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is healthy',
    environment: config.nodeEnv
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tokens', tokenRoutes);

// Test database connection
testConnection()
  .then(success => {
    if (!success) {
      console.warn('Warning: Database connection failed. Some features may not work correctly.');
    }
  })
  .catch(error => {
    console.error('Failed to test database connection:', error);
  });

// Error handling middleware
app.use(globalErrorHandler);

// Start server
const server = app.listen(config.port, () => {
  console.log(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
});

// Handle unhandled rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('UNHANDLED REJECTION! Shutting down...');
  console.error(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

export default app; 
