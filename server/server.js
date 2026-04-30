import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import connectDB from './config/db.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';

dotenv.config({ path: new URL('.env', import.meta.url) });

const app = express();

//middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.get('/',(req,res)=>res.send("Api Working"))

// Error Handling Middleware
app.use(notFound);
app.use(errorHandler);

// connect to database
await connectDB()

// port
const PORT = process.env.PORT || 5000
app.listen(PORT,()=>{
    console.log(`Server is running on port ${PORT}`)
})
