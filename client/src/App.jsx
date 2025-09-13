import React, { useState } from 'react';
import RoomJoin from './components/RoomJoin.jsx';
import Whiteboard from './components/Whiteboard.jsx';

export default function App() {
	const [roomId, setRoomId] = useState(null);
	const [userId] = useState(() => crypto.randomUUID().slice(0, 8));

	return (
		<div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
			{!roomId && <RoomJoin onJoin={setRoomId} />}
			{roomId && <Whiteboard roomId={roomId} userId={userId} onLeave={() => setRoomId(null)} />}
		</div>
	);
}
