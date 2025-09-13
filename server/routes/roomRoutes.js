import { Router } from 'express';
import Room from '../models/Room.js';

const router = Router();
const CODE_REGEX = /^[a-zA-Z0-9]{6,8}$/;

router.post('/join', async (req, res) => {
	try {
		let { roomId } = req.body || {};
		if (!CODE_REGEX.test(roomId || '')) return res.status(400).json({ message: 'Invalid room code' });
		roomId = roomId.toLowerCase();
		let room = await Room.findOne({ roomId });
		if (!room) {
			try {
				room = await Room.create({ roomId });
			} catch (err) {
				// Handle race condition duplicate creation
				if (err.code === 11000) {
					room = await Room.findOne({ roomId });
				} else {
					throw err;
				}
			}
		} else {
			room.lastActivity = new Date();
			await room.save();
		}
		res.json({ roomId });
	} catch (e) {
		console.error('POST /api/rooms/join error', { message: e.message, stack: e.stack });
		res.status(500).json({ message: 'Server error joining room' });
	}
});

router.get('/:roomId', async (req, res) => {
	try {
		const { roomId } = req.params;
		if (!CODE_REGEX.test(roomId || '')) return res.status(400).json({ message: 'Invalid room code' });
		const room = await Room.findOne({ roomId: roomId.toLowerCase() });
		if (!room) return res.status(404).json({ message: 'Not found' });
		res.json({ roomId: room.roomId, createdAt: room.createdAt, lastActivity: room.lastActivity, strokes: room.drawingData.length });
	} catch (e) {
		console.error(e);
		res.status(500).json({ message: 'Server error' });
	}
});

export default router;
