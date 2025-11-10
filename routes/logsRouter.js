// routes/logsRouter.js
import express from "express";
import { protect } from "../middlewares/authMiddleware.js";

import {
  saveLogs,
  getAllLogs,
  getUserLogById,
  deleteLog,
  deleteAllLogs,
  getLogsByActionType
} from "../controllers/logController.js";

const router = express.Router();
router.use(protect);


// Create log
router.post("/", saveLogs);

// Get all logs
router.get("/", getAllLogs);

// Get logs by user ID
router.post("/user", getUserLogById);

// Get logs by action type (e.g. /logs/type/DELETE)
router.get("/type/:actionType", getLogsByActionType);

// Delete single log
router.delete("/:id", deleteLog);

// Delete all logs (admin only)
router.delete("/", deleteAllLogs);

export default router;
