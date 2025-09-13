import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import roomRoutes from './routes/roomRoutes.js';
import { registerSocketHandlers } from './socket/index.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || '*'}));

app.get('/health', (_req, res) => res.json({ status: 'ok', time: Date.now() }));
app.use('/api/rooms', roomRoutes);

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);
const io = new Server(server, {
	cors: { origin: process.env.CORS_ORIGIN?.split(',') || '*'}
});

io.on('connection', (socket) => {
	registerSocketHandlers(io, socket);
});

async function connectMongo() {
	const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/whiteboard_dev';
	await mongoose.connect(uri, { autoIndex: true });
	console.log('Mongo connected');
}

connectMongo().catch(err => {
	console.error('Mongo connection error', err);
	process.exit(1);
});

// Cleanup job: remove rooms inactive >24h every hour
const ONE_HOUR = 60 * 60 * 1000;
setInterval(async () => {
	try {
		const Room = (await import('./models/Room.js')).default;
		const cutoff = new Date(Date.now() - 24 * ONE_HOUR);
		const result = await Room.deleteMany({ lastActivity: { $lt: cutoff } });
		if (result.deletedCount) {
			console.log(`Cleanup: removed ${result.deletedCount} inactive rooms`);
		}
	} catch (e) {
		console.error('Cleanup error', e);
	}
}, ONE_HOUR).unref();

server.listen(PORT, () => {
	console.log(`Server listening on :${PORT}`);
});
