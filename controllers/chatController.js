// controllers/chatController.js
import ChatMessage from "../models/chatMessage.js";
import { getIO,getOnlineUsersList } from "../socket.js";

// Get chat messages (paginated)
export async function getChatMessages(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await ChatMessage.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Reverse to show oldest first in UI
    const reversedMessages = messages.reverse();

    const total = await ChatMessage.countDocuments();

    res.status(200).json({
      messages: reversedMessages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (err) {
    next(err);
  }
}

// Send a new chat message
export async function sendMessage(req, res, next) {
  try {
    const { message } = req.body;

    if (!message || message.trim() === '') {
      return res.status(400).json({ message: "Le message ne peut pas être vide" });
    }

    const chatMessage = new ChatMessage({
      user: {
        userId: req.user.id,
        nom: req.user.nom,
        prenom: req.user.prenom,
        role: req.user.role,
        email: req.user.email
      },
      message: message.trim()
    });

    await chatMessage.save();

    // Emit to all connected clients
    const io = getIO();
    io.emit('newChatMessage', chatMessage);

    res.status(201).json(chatMessage);
  } catch (err) {
    next(err);
  }
}

// Get online users (optional)
export async function getOnlineUsers(req, res, next) {
    try {
      const uniqueUsers = getOnlineUsersList();
      res.status(200).json(uniqueUsers);
    } catch (err) {
      next(err);
    }
  }
  