import React from 'react';

export default function UserCursors({ cursors, selfId }) {
	return (
		<div style={{ pointerEvents:'none', position:'absolute', inset:0 }}>
			{Object.entries(cursors).filter(([id]) => id !== selfId).map(([id, c]) => (
				<div key={id} style={{ position:'absolute', left:c.x, top:c.y, transform:'translate(-4px, -4px)' }}>
					<svg width="12" height="12" viewBox="0 0 24 24" fill={c.color||'#fff'} stroke="none">
						<path d="M3 2l7 18 2-7 7 2L3 2z" />
					</svg>
				</div>
			))}
		</div>
	);
}
