import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';

const DrawingCanvas = forwardRef(function DrawingCanvas({ userId, strokes, onStrokeEvent, onCursorMove, color, width }, ref) {
	const canvasRef = useRef(null);
	const drawing = useRef(false);
	const currentPath = useRef([]);
	const lastEmit = useRef(0); // legacy time throttle (kept for fallback)
	const pendingCursor = useRef(null);
	const rafId = useRef(null);
	const remoteStrokes = useRef({}); // userId -> { points, color, width }
	const pendingPoints = useRef([]);
	const moveRaf = useRef(null);

	// expose color/width setters via custom event (used by Toolbar)
	// Instead simpler: lift state up, but for brevity keep here and rely on custom events unrealistic but fine.

	const lastStrokeIndex = useRef(0);

	useEffect(() => {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');
		function resize() {
			// on resize we need full redraw
			const snapshot = ctx.getImageData(0,0,canvas.width,canvas.height);
			canvas.width = canvas.parentElement.clientWidth;
			canvas.height = canvas.parentElement.clientHeight;
			ctx.putImageData(snapshot,0,0);
		}
		window.addEventListener('resize', resize);
		canvas.width = canvas.parentElement.clientWidth;
		canvas.height = canvas.parentElement.clientHeight;
		// initial full paint
		fullRedraw();
		lastStrokeIndex.current = strokes.length;
		return () => window.removeEventListener('resize', resize);
	}, []);

	function fullRedraw() {
		const canvas = canvasRef.current;
		const ctx = canvas.getContext('2d');
		ctx.clearRect(0,0,canvas.width,canvas.height);
		// replay persisted strokes
		for (const cmd of strokes) {
			if (cmd.type === 'clear') { ctx.clearRect(0,0,canvas.width,canvas.height); continue; }
			if (cmd.type === 'stroke') {
				const { points, color: sc, width: sw } = cmd.data;
				if (!points || points.length < 2) continue;
				ctx.strokeStyle = sc; ctx.lineWidth = sw; ctx.lineJoin='round'; ctx.lineCap='round';
				ctx.beginPath();
				ctx.moveTo(points[0].x, points[0].y);
				for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
				ctx.stroke();
			}
		}
		// re-layer in-progress local path
		if (currentPath.current.length > 1) {
			ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin='round'; ctx.lineCap='round';
			ctx.beginPath();
			ctx.moveTo(currentPath.current[0].x, currentPath.current[0].y);
			for (let i=1;i<currentPath.current.length;i++) ctx.lineTo(currentPath.current[i].x, currentPath.current[i].y);
			ctx.stroke();
		}
		// re-layer in-progress remote strokes
		Object.values(remoteStrokes.current).forEach(s => {
			if (s.points.length < 2) return;
			ctx.strokeStyle = s.color; ctx.lineWidth = s.width; ctx.lineJoin='round'; ctx.lineCap='round';
			ctx.beginPath();
			ctx.moveTo(s.points[0].x, s.points[0].y);
			for (let i=1;i<s.points.length;i++) ctx.lineTo(s.points[i].x, s.points[i].y);
			ctx.stroke();
		});
	}

	// append-only rendering for new persisted strokes
	useEffect(() => {
		if (!canvasRef.current) return;
		// detect if a clear occurred among new commands; if so full redraw
		const newCmds = strokes.slice(lastStrokeIndex.current);
		const hasClear = newCmds.some(c => c.type === 'clear');
		if (hasClear) {
			fullRedraw();
			lastStrokeIndex.current = strokes.length;
			return;
		}
		const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
		for (const cmd of newCmds) {
			if (cmd.type !== 'stroke') continue;
			const { points, color: sc, width: sw } = cmd.data;
			if (!points || points.length < 2) continue;
			ctx.strokeStyle = sc; ctx.lineWidth = sw; ctx.lineJoin='round'; ctx.lineCap='round';
			ctx.beginPath();
			ctx.moveTo(points[0].x, points[0].y);
			for (let i=1;i<points.length;i++) ctx.lineTo(points[i].x, points[i].y);
			ctx.stroke();
		}
		lastStrokeIndex.current = strokes.length;
	}, [strokes]);

	// removed global redraw effect in favor of incremental append logic

	function pointerPos(e) {
		const rect = canvasRef.current.getBoundingClientRect();
		return { x: e.clientX - rect.left, y: e.clientY - rect.top };
	}

	function handleDown(e) {
		e.preventDefault();
		drawing.current = true;
		currentPath.current = [pointerPos(e)];
		onStrokeEvent('draw-start', { color, width });
	}
	function flushCursor() {
		if (!pendingCursor.current) return;
		onCursorMove(pendingCursor.current);
		pendingCursor.current = null;
	}

	function scheduleCursor(point) {
		pendingCursor.current = point;
		if (rafId.current) return;
		rafId.current = requestAnimationFrame(() => {
			rafId.current = null;
			flushCursor();
		});
	}

	function flushMoveBatch() {
		if (!pendingPoints.current.length) return;
		onStrokeEvent('draw-move', { points: pendingPoints.current });
		pendingPoints.current = [];
		moveRaf.current = null;
	}

	function scheduleMovePoint(pt) {
		pendingPoints.current.push(pt);
		if (moveRaf.current) return;
		moveRaf.current = requestAnimationFrame(flushMoveBatch);
	}

	function handleMove(e) {
		if (!drawing.current) {
			// schedule cursor at ~display refresh via rAF
			scheduleCursor({ ...pointerPos(e) });
			return;
		}
		const pt = pointerPos(e);
		currentPath.current.push(pt);
		drawSegment();
		scheduleMovePoint(pt);
	}
	function handleUp() {
		if (!drawing.current) return;
		drawing.current = false;
		const data = { points: currentPath.current, color, width };
		onStrokeEvent('draw-end', data);
		currentPath.current = [];
	}

	function drawSegment() {
		const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
		const pts = currentPath.current; if (pts.length < 2) return;
		ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin='round'; ctx.lineCap='round';
		ctx.beginPath();
		ctx.moveTo(pts[pts.length-2].x, pts[pts.length-2].y);
		ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
		ctx.stroke();
	}

	function drawRemoteSegment(user, stroke) {
		const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
		const pts = stroke.points; if (pts.length < 2) return;
		ctx.strokeStyle = stroke.color; ctx.lineWidth = stroke.width; ctx.lineJoin='round'; ctx.lineCap='round';
		// simple gap smoothing: if distance > 12px, interpolate
		const a = pts[pts.length-2];
		const b = pts[pts.length-1];
		const dx = b.x - a.x; const dy = b.y - a.y;
		const dist = Math.hypot(dx, dy);
		let segments = 1;
		if (dist > 12) segments = Math.min(8, Math.ceil(dist / 8));
		ctx.beginPath();
		ctx.moveTo(a.x, a.y);
		for (let i=1;i<=segments;i++) {
			const t = i/segments;
			ctx.lineTo(a.x + dx * t, a.y + dy * t);
		}
		ctx.stroke();
	}

	useImperativeHandle(ref, () => ({
		remoteStart(uid, strokeMeta) {
			remoteStrokes.current[uid] = { points: [], color: strokeMeta.color, width: strokeMeta.width };
		},
		remoteMove(uid, point) {
			const s = remoteStrokes.current[uid]; if (!s) return;
			s.points.push(point);
			if (s.points.length > 1) drawRemoteSegment(uid, s);
		},
		remoteEnd(uid) {
			delete remoteStrokes.current[uid];
		}
	}), []);

	return (
		<canvas
			ref={canvasRef}
			style={{ width:'100%', height:'100%', display:'block', background:'#000' }}
			onPointerDown={handleDown}
			onPointerMove={handleMove}
			onPointerUp={handleUp}
			onPointerLeave={handleUp}
		/>
	);
});

export default DrawingCanvas;
