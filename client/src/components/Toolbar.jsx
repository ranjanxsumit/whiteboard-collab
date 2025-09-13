import React from 'react';

const COLORS = ['#ffffff', '#ef4444', '#3b82f6', '#10b981'];

export default function Toolbar({ roomId, userCount, connected, onClear, onLeave, color, setColor, width, setWidth }) {
	return (
		<div className="toolbar">
			<div className="room-meta">
				<strong>Room: {roomId}</strong>
				<span>Users: {userCount}</span>
				<span style={{ color: connected? '#10b981':'#f87171' }}>{connected? 'Online':'Offline'}</span>
			</div>
			<div className="colors">
				{COLORS.map(c => (
					<button
						key={c}
						className={`color-swatch ${c===color? 'active':''}`}
						style={{ background:c, border: c===color? '2px solid #fff':'1px solid #333' }}
						onClick={()=>setColor(c)}
					/>
				))}
			</div>
			<input type="range" min={1} max={24} value={width} onChange={e=>setWidth(Number(e.target.value))} />
			<div className="actions">
				<button onClick={onClear}>Clear</button>
				<button className="leave" onClick={onLeave}>Leave</button>
			</div>
		</div>
	);
}
