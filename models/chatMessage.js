import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    user: {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
      nom: { type: String, required: true },
      prenom: { type: String, required: true },
      role: { type: String, required: true },
      email: { type: String, required: true }
    },
    message: { type: String, required: true },
    room: { type: String, default: 'general' } // For future room support
  },
  { timestamps: true }
);

const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
export default ChatMessage;