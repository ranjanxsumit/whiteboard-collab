import mongoose from 'mongoose';

const DrawingCommandSchema = new mongoose.Schema({
	type: { type: String, enum: ['stroke', 'clear'], required: true },
	// data was previously required; made optional with default to avoid validation errors on legacy entries
	data: { type: mongoose.Schema.Types.Mixed, required: false, default: {} },
	timestamp: { type: Date, default: Date.now }
}, { _id: false });

const RoomSchema = new mongoose.Schema({
	roomId: { type: String, required: true, unique: true, index: true },
	createdAt: { type: Date, default: Date.now },
	lastActivity: { type: Date, default: Date.now },
	drawingData: { type: [DrawingCommandSchema], default: [] }
});

export default mongoose.model('Room', RoomSchema);
