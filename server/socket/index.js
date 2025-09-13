import Room from '../models/Room.js';

const ROOM_CODE_REGEX = /^[a-zA-Z0-9]{6,8}$/;

function userCount(io, roomId) {
	const room = io.sockets.adapter.rooms.get(roomId);
	return room ? room.size : 0;
}

export function registerSocketHandlers(io, socket) {
	let currentRoom = null;
	let userId = socket.id; // could be extended
	// Map roomId -> { socketId: color }
	const roomColorMap = io._roomColorMap || (io._roomColorMap = new Map());
	// Cursor color palette (cycled, reused if exhausted)
	const palette = ['#f87171','#60a5fa','#34d399','#fbbf24','#a78bfa','#fb7185','#4ade80','#38bdf8'];

	function assignColor(roomId, socketId) {
		let m = roomColorMap.get(roomId);
		if (!m) { m = new Map(); roomColorMap.set(roomId, m); }
		if (m.has(socketId)) return m.get(socketId);
		const used = new Set([...m.values()]);
		const color = palette.find(c => !used.has(c)) || palette[Math.floor(Math.random()*palette.length)];
		m.set(socketId, color);
		return color;
	}

	function getColor(roomId, socketId) {
		const m = roomColorMap.get(roomId);
		return m?.get(socketId);
	}

	function removeColor(roomId, socketId) {
		const m = roomColorMap.get(roomId);
		if (m) { m.delete(socketId); if (m.size === 0) roomColorMap.delete(roomId); }
	}

	const broadcastUserCount = () => {
		if (currentRoom) {
			io.to(currentRoom).emit('user-count', { count: userCount(io, currentRoom) });
		}
	};

	socket.on('join-room', async ({ roomId }) => {
		try {
			if (!ROOM_CODE_REGEX.test(roomId || '')) return;
			roomId = roomId.toLowerCase();
			if (currentRoom) socket.leave(currentRoom);
			currentRoom = roomId;
			socket.join(roomId);
			const color = assignColor(roomId, socket.id);
			// load existing drawing data
			const room = await Room.findOne({ roomId });
			if (room) {
				socket.emit('init-data', room.drawingData);
				room.lastActivity = new Date();
				await room.save();
			}
			// send count to new socket immediately then broadcast to others
			socket.emit('user-count', { count: userCount(io, currentRoom) });
			// inform others of presence (optional future extension)
			socket.emit('cursor-color', { userId, color });
			broadcastUserCount();
		} catch (e) {
			console.error('join-room error', e);
		}
	});

	socket.on('cursor-move', (data) => {
		if (!currentRoom) return;
		const color = getColor(currentRoom, socket.id);
		socket.to(currentRoom).emit('cursor-move', { userId, color, x: data.x, y: data.y });
	});

	socket.on('draw-start', (data) => {
		if (!currentRoom) return;
		socket.to(currentRoom).emit('draw-start', { userId, ...data });
	});

	socket.on('draw-move', (data) => {
		if (!currentRoom) return;
		// normalize: accept { point } or { points: [] }
		let payload;
		if (data.points && Array.isArray(data.points)) {
			payload = { points: data.points };
		} else if (data.point) {
			payload = { points: [data.point] };
		} else {
			return; // ignore malformed
		}
		socket.to(currentRoom).emit('draw-move', { userId, ...payload });
	});

	socket.on('draw-end', async (data) => {
		if (!currentRoom) return;
		socket.to(currentRoom).emit('draw-end', { userId, ...data });
		// persist stroke
		try {
			const room = await Room.findOne({ roomId: currentRoom });
			if (room) {
				room.drawingData.push({ type: 'stroke', data, timestamp: new Date() });
				room.lastActivity = new Date();
				if (room.drawingData.length > 5000) {
					room.drawingData = room.drawingData.slice(-4000); // prune older
				}
				await room.save();
			}
		} catch (e) {
			console.error('persist stroke error', e);
		}
	});

	socket.on('clear-canvas', async () => {
		if (!currentRoom) return;
		socket.to(currentRoom).emit('clear-canvas');
		try {
			const room = await Room.findOne({ roomId: currentRoom });
			if (room) {
				room.drawingData.push({ type: 'clear', data: {}, timestamp: new Date() });
				room.lastActivity = new Date();
				await room.save();
			}
		} catch (e) {
			console.error('clear persist error', e);
		}
	});

	socket.on('disconnect', () => {
		if (currentRoom) removeColor(currentRoom, socket.id);
		broadcastUserCount();
	});
}
