import React, { useState } from 'react';
import axios from 'axios';

const CODE_REGEX = /^[a-zA-Z0-9]{6,8}$/;

export default function RoomJoin({ onJoin }) {
	const [code, setCode] = useState('');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState('');

	async function submit(e) {
		e.preventDefault();
		setError('');
		const trimmed = code.trim();
		if (!CODE_REGEX.test(trimmed)) { setError('Code must be 6-8 letters/numbers'); return; }
		try {
			setLoading(true);
			const res = await axios.post('/api/rooms/join', { roomId: trimmed });
			onJoin(res.data.roomId);
		} catch (err) {
			setError(err.response?.data?.message || 'Failed to join room');
		} finally { setLoading(false); }
	}

	function randomCode() {
		const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
		let s=''; for (let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)];
		setCode(s);
	}

	return (
		<form onSubmit={submit} style={{ margin: 'auto', textAlign: 'center', maxWidth: 360 }}>
			<h1 style={{ marginBottom: 8 }}>Collaborative Whiteboard</h1>
			<p style={{ opacity: .7 }}>Enter a room code to join or create a new room.</p>
			<div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
				<input
					value={code}
					onChange={e=>setCode(e.target.value)}
					placeholder="Room code (6-8)"
					style={{ flex: 1, padding: '10px 12px', borderRadius: 6, border: '1px solid #333', background:'#222', color:'#fff', fontSize:16 }}
				/>
				<button type="button" onClick={randomCode} style={btnStyle}>Random</button>
			</div>
			{error && <div style={{ color: '#ff6464', marginTop:8 }}>{error}</div>}
			<button disabled={loading} type="submit" style={{ ...btnStyle, width: '100%', marginTop:16, background:'#2563eb' }}>
				{loading ? 'Joining...' : 'Join Room'}
			</button>
			<div style={{ marginTop:24, fontSize:12, opacity:.5 }}>No auth required. Share the code with others.</div>
		</form>
	);
}

const btnStyle = { padding:'10px 14px', background:'#444', color:'#fff', border:'1px solid #333', borderRadius:6, fontSize:14 };
