import { Router } from "express";
import { getChatMessages, sendMessage, getOnlineUsers } from "../controllers/chatController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = Router();

// All routes require authentication
router.use(protect);

router.get("/messages", getChatMessages);
router.post("/messages", sendMessage);
router.get("/online-users", getOnlineUsers);

export default router;