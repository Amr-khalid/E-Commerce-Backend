import { connectDB } from '../src/config/database.js';
import app from '../src/app.js';

// Cache the MongoDB connection across serverless invocations
let isConnected = false;

const handler = async (req, res) => {
  if (!isConnected) {
    await connectDB();
    isConnected = true;
  }
  return app(req, res);
};

export default handler;
