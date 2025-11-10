// routes/userRouter.js
import express from "express";
import { 
  register, 
  login, 
  updateProfile,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser
} from "../controllers/userController.js";
import { protect } from "../middlewares/authMiddleware.js"; 

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected routes (require authentication)
router.put("/profile", protect, updateProfile);

// Admin only routes - User management
router.get("/", protect, getAllUsers); // GET /api/users - Get all users
router.get("/:id", protect, getUserById); // GET /api/users/:id - Get user by ID
router.put("/:id", protect, updateUser); // PUT /api/users/:id - Update user
router.delete("/:id", protect, deleteUser); // DELETE /api/users/:id - Delete user

export default router;