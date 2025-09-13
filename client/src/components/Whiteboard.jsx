import React, { useEffect, useRef, useState, useCallback } from 'react';
import '../whiteboard.css';
import { io } from 'socket.io-client';
import DrawingCanvas from './DrawingCanvas.jsx';
import Toolbar from './Toolbar.jsx';
import UserCursors from './UserCursors.jsx';

export default function Whiteboard({ roomId, userId, onLeave }) {
	const socketRef = useRef(null);
	const [connected, setConnected] = useState(false);
	const [userCount, setUserCount] = useState(1);
	const [strokes, setStrokes] = useState([]); // persisted commands
		const [remoteCursors, setRemoteCursors] = useState({});
		const [color, setColor] = useState('#ffffff');
		const [width, setWidth] = useState(4);
	const canvasApiRef = useRef(null);

	useEffect(() => {
		// Determine socket base: explicit env > same-origin (production) > localhost dev
		let base = import.meta.env.VITE_SOCKET_URL;
		if (!base) {
			if (window.location.hostname !== 'localhost') {
				base = window.location.origin; // deployed same-origin
			} else {
				base = 'http://localhost:4000';
			}
		}
		const socket = io(base, { transports: ['websocket','polling'] });
		socketRef.current = socket;
		socket.on('connect', () => {
			setConnected(true);
			socket.emit('join-room', { roomId });
		});
		socket.on('connect_error', (err) => {
			console.error('Socket connect_error', err.message);
		});
		socket.on('error', (err) => console.error('Socket error', err));
		socket.on('disconnect', () => setConnected(false));
		socket.on('user-count', ({ count }) => setUserCount(count));
		socket.on('init-data', (data) => setStrokes(data));
		socket.on('clear-canvas', () => setStrokes(prev => [...prev, { type: 'clear', data: {}, timestamp: Date.now() }]));
		socket.on('draw-start', ({ userId: uid, color: c, width: w }) => {
			if (uid === userId) return; // local already drawing
			canvasApiRef.current?.remoteStart(uid, { color: c, width: w });
		});
		socket.on('draw-move', ({ userId: uid, points }) => {
			if (uid === userId) return;
			if (Array.isArray(points)) {
				points.forEach(p => canvasApiRef.current?.remoteMove(uid, p));
			}
		});
		socket.on('draw-end', (cmd) => setStrokes(prev => [...prev, { type: 'stroke', data: cmd, timestamp: Date.now() }]));
		socket.on('cursor-move', ({ userId: uid, x, y, color }) => {
			setRemoteCursors(rc => ({ ...rc, [uid]: { x, y, color, ts: Date.now() } }));
		});
		return () => { socket.disconnect(); };
	}, [roomId]);

	// Cleanup inactive cursors
	useEffect(() => {
		const interval = setInterval(() => {
			setRemoteCursors(rc => {
				const now = Date.now();
				const next = {};
				Object.entries(rc).forEach(([k,v]) => { if (now - v.ts < 3000) next[k]=v; });
				return next;
			});
		}, 2000);
		return () => clearInterval(interval);
	}, []);

	const sendCursor = useCallback((pos) => {
		socketRef.current?.emit('cursor-move', pos);
	}, []);

	const sendStrokeEvent = useCallback((type, payload) => {
		// augment with local meta
		if (type === 'draw-start') {
			const meta = { ...payload, color, width };
			socketRef.current?.emit(type, meta);
		} else {
			socketRef.current?.emit(type, payload);
		}
	}, [color, width]);

	const clearCanvas = useCallback(() => {
		socketRef.current?.emit('clear-canvas');
		setStrokes(prev => [...prev, { type: 'clear', data: {}, timestamp: Date.now() }]);
	}, []);

	return (
		<div className="whiteboard-root">
			<Toolbar onLeave={onLeave} roomId={roomId} userCount={userCount} connected={connected} onClear={clearCanvas} color={color} setColor={setColor} width={width} setWidth={setWidth} />
			<div className="whiteboard-stage">
				<DrawingCanvas
					ref={canvasApiRef}
					userId={userId}
					strokes={strokes}
					onStrokeEvent={sendStrokeEvent}
					onCursorMove={sendCursor}
					color={color}
					width={width}
				/>
				<UserCursors cursors={remoteCursors} selfId={userId} />
			</div>
		</div>
	);
}
