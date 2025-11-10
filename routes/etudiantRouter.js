// routes/etudiantRouter.js
import { Router } from "express";
import multer from "multer";
import path from "path";

import {
  getAllEtudiants,
  getEtudiantById,
  createEtudiant,
  updateEtudiant,
  deleteEtudiant,
  checkEmailExists,
  AddEtudiantWithPhoto,
  updateEtudiantWithPhoto
} from "../controllers/etudiantController.js";

import { protect } from "../middlewares/authMiddleware.js";
import { authorize } from "../middlewares/roleMiddleware.js";

export const monRouter = Router();

// ✅ Configure Multer to store in memory (for Sharp processing)
const storage = multer.memoryStorage(); // Store in memory, not disk

// Configure Multer for CREATE (temp files)
const uploadForCreate = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit (before compression)
  }
});

// Configure Multer for UPDATE (with ID)
const uploadForUpdate = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit (before compression)
  }
});

// ✅ Apply protect middleware to all routes
monRouter.use(protect);

// ✅ IMPORTANT: Specific routes MUST come before generic ones
// Photo upload routes (more specific) - BEFORE /:id routes
monRouter.post("/add-with-photo", authorize("admin"), uploadForCreate.single("photo"), AddEtudiantWithPhoto);
monRouter.put("/:id/update-with-photo", authorize("admin"), uploadForUpdate.single("photo"), updateEtudiantWithPhoto);

// Check email route (specific path)
monRouter.get("/check-email", checkEmailExists);

// General routes (less specific) - AFTER specific routes
monRouter.get("/", getAllEtudiants);
monRouter.get("/:id", getEtudiantById);

// Admin-only routes
monRouter.post("/", authorize("admin"), createEtudiant);
monRouter.put("/:id", authorize("admin"), updateEtudiant);
monRouter.delete("/:id", authorize("admin"), deleteEtudiant);

export default monRouter;