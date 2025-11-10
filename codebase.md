# controllers/chatController.js

```js
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
  
```

# controllers/etudiantController.js

```js
// controllers/etudiantController.js
import Etudiant from "../models/etudiant.js";
import { getIO } from "../socket.js";
import fs from "fs";
import log from "../models/log.js";
import sharp from "sharp";


/**
 * Get paginated etudiants. Search supports single-term (search across fields)
 * or two+ terms (first term -> name/email, second -> matiere).
 */
/**
 * Helper function to compress and save image
 * @param {Buffer} buffer - Image buffer from multer
 * @param {string} filename - Desired filename (e.g., "123-John.jpg")
 * @returns {Promise<string>} - Full path to saved file
 */
async function compressAndSaveImage(buffer, filename) {
  const outputPath = path.join(process.cwd(), "uploads", filename);
  
  await sharp(buffer)
    .resize(800, 800, { // Max 800x800px, maintain aspect ratio
      fit: 'inside',
      withoutEnlargement: true // Don't upscale small images
    })
    .jpeg({ 
      quality: 85, // 85% quality (good balance between size and quality)
      progressive: true // Progressive JPEG for faster loading
    })
    .toFile(outputPath);
  
  return outputPath;
}


export async function getAllEtudiants(req, res, next) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    let query = {};

    if (search) {
      const searchTerms = search.split(/\s+/).filter(Boolean);

      if (searchTerms.length === 1) {
        const searchRegex = new RegExp(searchTerms[0], "i");
        query = {
          $or: [
            { nom: searchRegex },
            { prenom: searchRegex },
            { email: searchRegex },
            { matiere: { $in: [searchRegex] } },
          ],
        };
      } else {
        const [prenomTerm, matiereTerm] = searchTerms;
        const prenomRegex = new RegExp(prenomTerm, "i");
        const matiereRegex = new RegExp(matiereTerm, "i");

        query = {
          $and: [
            {
              $or: [
                { prenom: prenomRegex },
                { nom: prenomRegex },
                { email: prenomRegex },
              ],
            },
            { matiere: { $in: [matiereRegex] } },
          ],
        };
      }
    }

    const total = await Etudiant.countDocuments(query);

    const etudiants = await Etudiant.find(query, { _id: 1, __v: 0 })
      .sort({ id: 1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    res.status(200).json({
      etudiants,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNext,
        hasPrev,
        searchTerm: search,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getEtudiantById(req, res, next) {
  try {
    const etudiant = await Etudiant.findOne({ id: req.params.id }, { _id: 0, __v: 0 });
    if (!etudiant) {
      return res.status(404).json({ message: "Étudiant non trouvé" });
    }
    else{
      // setTimeout(()=>{res.status(200).json(etudiant)},700)
      res.status(200).json(etudiant)

    }
    
  } catch (err) {
    next(err);
  }
}

export async function createEtudiant(req, res, next) {
  try {
    const { nom, prenom, email, matiere } = req.body;

    // Check required fields
    if (!nom || !prenom || !email) {
      return res.status(400).json({ message: "Les champs 'nom', 'prenom' et 'email' sont requis." });
    }

    const lastEtudiant = await Etudiant.findOne().sort({ id: -1 });
    const newId = lastEtudiant ? lastEtudiant.id + 1 : 1;

    // Duplicate check on email and id
    const existingEtudiant = await Etudiant.findOne({
      $or: [{ email }, { id: newId }],
    });
    if (existingEtudiant) {
      return res.status(400).json({ message: "Un étudiant avec cet ID ou cet email existe déjà." });
    }

    const newEtudiant = new Etudiant({ ...req.body, id: newId });
    await newEtudiant.save();

    // Ensure we have complete user information
    const performedBy = {
      nom: req.user.nom,
      prenom: req.user.prenom,
      role: req.user.role,
      email: req.user.email
    };

    console.log('👤 CREATE Action performed by:', performedBy);

    const payload = {
      ...newEtudiant.toObject(),
      performedBy: performedBy  // Make sure this is included
    };
    delete payload.__v;

    // Emit event to clients (if IO initialized)
    try {
      const io = getIO();
      console.log('📤 Emitting etudiantCreated event. Connected clients:', io.engine.clientsCount);
      io.emit("etudiantCreated", payload);
      console.log('✅ etudiantCreated event emitted for student ID:', newEtudiant.id);
    } catch (emitErr) {
      console.error("❌ Socket emit failed (etudiantCreated):", emitErr?.message || emitErr);
    }

    res.status(200).json(newEtudiant);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: "Un étudiant avec cet ID ou cet email existe déjà." });
    }
    next(err);
  }
}

import path from "path";

export async function AddEtudiantWithPhoto(req, res, next) {
  try {
    const { nom, prenom, email, matiere } = req.body;

    // ✅ Validate required fields
    if (!nom || !prenom || !email) {
      return res.status(400).json({
        message: "Les champs 'nom', 'prenom' et 'email' sont requis.",
      });
    }

    // ✅ Auto-generate new ID
    const lastEtudiant = await Etudiant.findOne().sort({ id: -1 });
    const newId = lastEtudiant ? lastEtudiant.id + 1 : 1;

    // ✅ Prevent duplicate emails
    const existingEtudiant = await Etudiant.findOne({ email });
    if (existingEtudiant) {
      return res.status(400).json({ message: "Un étudiant avec cet email existe déjà." });
    }

    // ✅ Handle photo upload with compression
    let photoUrl = null;
    if (req.file) {
      const filename = `${newId}-${nom}.jpg`; // Always save as .jpg after compression
      
      console.log('📸 Original file size:', (req.file.size / 1024).toFixed(2), 'KB');
      
      await compressAndSaveImage(req.file.buffer, filename);
      
      // Check compressed file size
      const compressedPath = path.join(process.cwd(), "uploads", filename);
      const compressedSize = fs.statSync(compressedPath).size;
      console.log('✅ Compressed file size:', (compressedSize / 1024).toFixed(2), 'KB');
      console.log('💾 Saved space:', ((req.file.size - compressedSize) / 1024).toFixed(2), 'KB');
      
      photoUrl = `http://localhost:3000/uploads/${filename}`;
    }

    // ✅ Parse `matiere` safely
    let matieres = [];
    try {
      matieres = matiere ? JSON.parse(matiere) : [];
    } catch {
      matieres = [matiere];
    }

    // ✅ Create new student
    const newStudent = new Etudiant({
      id: newId,
      nom,
      prenom,
      email,
      matiere: matieres,
      photo: photoUrl,
    });

    await newStudent.save();

    // ✅ Emit socket event
    const performedBy = {
      nom: req.user?.nom || 'Admin',
      prenom: req.user?.prenom || 'System',
      role: req.user?.role || 'admin',
      email: req.user?.email || 'system@admin.com'
    };

    const payload = {
      ...newStudent.toObject(),
      performedBy: performedBy
    };
    delete payload.__v;

    try {
      const io = getIO();
      io.emit("etudiantCreated", payload);
      console.log('✅ etudiantCreated event emitted for student ID:', newStudent.id);
    } catch (emitErr) {
      console.error("❌ Socket emit failed:", emitErr?.message || emitErr);
    }

    res.status(201).json({
      message: "Étudiant ajouté avec succès avec photo",
      student: newStudent,
    });
  } catch (error) {
    console.error("❌ Error adding student with photo:", error.message);
    res.status(500).json({ message: error.message });
  }
}

export async function updateEtudiant(req, res, next) {
  try {
    console.log('🔍 DEBUG - req.user:', req.user);
    console.log('🔍 DEBUG - req.headers:', req.headers);
    
    const etudiantId = parseInt(req.params.id, 10);
    const { email } = req.body;

    // Check if trying to update email to an already existing one (exclude current etudiant)
    if (email) {
      const existing = await Etudiant.findOne({ email, id: { $ne: etudiantId } });
      if (existing) {
        return res.status(400).json({ message: "Un étudiant avec cet email existe déjà." });
      }
    }

    const updatedEtudiant = await Etudiant.findOneAndUpdate({ id: etudiantId }, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedEtudiant) {
      return res.status(404).json({ message: "Étudiant non trouvé" });
    }

    // Ensure we have complete user information - with fallbacks
    const performedBy = {
      nom: req.user.nom || 'Admin',
      prenom: req.user.prenom || 'System', 
      role: req.user.role || 'admin',
      email: req.user.email || 'system@admin.com'
    };

    console.log('👤 Action performed by:', performedBy);

    const payload = {
      ...updatedEtudiant.toObject(),
      performedBy: performedBy
    };
    delete payload.__v;

    try {
      const io = getIO();
      console.log('📤 Emitting etudiantUpdated event. Connected clients:', io.engine.clientsCount);
      io.emit("etudiantUpdated", payload);
      console.log('✅ etudiantUpdated event emitted for student ID:', updatedEtudiant.id);
    } catch (emitErr) {
      console.error("❌ Socket emit failed (etudiantUpdated):", emitErr?.message || emitErr);
    }

    res.status(200).json(updatedEtudiant);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: "Un étudiant avec cet email existe déjà." });
    }
    next(err);
  }
}


export async function updateEtudiantWithPhoto(req, res, next) {
  try {
    const etudiantId = parseInt(req.params.id, 10);
    const { nom, prenom, email, matiere } = req.body;

    console.log('🔄 Updating student with photo. ID:', etudiantId);
    console.log('📝 Request body:', { nom, prenom, email, matiere });
    console.log('📸 File uploaded:', req.file ? 'Yes' : 'No');

    // ✅ Find existing student
    const existingEtudiant = await Etudiant.findOne({ id: etudiantId });
    if (!existingEtudiant) {
      return res.status(404).json({ message: "Étudiant non trouvé" });
    }

    // ✅ Prevent duplicate emails (ignore same student)
    if (email && email !== existingEtudiant.email) {
      const emailExists = await Etudiant.findOne({ email, id: { $ne: etudiantId } });
      if (emailExists) {
        return res.status(400).json({ message: "Un étudiant avec cet email existe déjà." });
      }
    }

    // ✅ Handle new photo with compression (if uploaded)
    let photoUrl = existingEtudiant.photo;
    if (req.file) {
      const filename = `${etudiantId}-${nom || existingEtudiant.nom}.jpg`;
      
      console.log('📸 Original file size:', (req.file.size / 1024).toFixed(2), 'KB');
      
      await compressAndSaveImage(req.file.buffer, filename);
      
      // Check compressed file size
      const compressedPath = path.join(process.cwd(), "uploads", filename);
      const compressedSize = fs.statSync(compressedPath).size;
      console.log('✅ Compressed file size:', (compressedSize / 1024).toFixed(2), 'KB');
      console.log('💾 Saved space:', ((req.file.size - compressedSize) / 1024).toFixed(2), 'KB');
      
      photoUrl = `http://localhost:3000/uploads/${filename}`;

      // Delete old photo if it exists and is different from new one
      if (existingEtudiant.photo && existingEtudiant.photo.startsWith("http://localhost:3000/uploads/")) {
        const oldFilename = path.basename(existingEtudiant.photo);
        if (oldFilename !== filename) {
          const oldPath = path.join(process.cwd(), "uploads", oldFilename);
          fs.unlink(oldPath, (err) => {
            if (err) console.warn("⚠️ Could not delete old photo:", err.message);
            else console.log("🗑️ Old photo deleted:", oldPath);
          });
        }
      }
    }

    // ✅ Parse `matiere`
    let matieres = [];
    try {
      matieres = matiere ? JSON.parse(matiere) : existingEtudiant.matiere;
    } catch {
      matieres = [matiere];
    }

    // ✅ Update fields
    existingEtudiant.nom = nom || existingEtudiant.nom;
    existingEtudiant.prenom = prenom || existingEtudiant.prenom;
    existingEtudiant.email = email || existingEtudiant.email;
    existingEtudiant.matiere = matieres;
    existingEtudiant.photo = photoUrl;

    await existingEtudiant.save();

    console.log('✅ Student updated successfully:', existingEtudiant.id);

    // ✅ Emit socket update event
    const performedBy = {
      nom: req.user?.nom || 'Admin',
      prenom: req.user?.prenom || 'System',
      role: req.user?.role || 'admin',
      email: req.user?.email || 'system@admin.com'
    };

    const payload = {
      ...existingEtudiant.toObject(),
      performedBy: performedBy
    };
    delete payload.__v;

    try {
      const io = getIO();
      io.emit("etudiantUpdated", payload);
      console.log('✅ etudiantUpdated emitted for:', existingEtudiant.id);
    } catch (err) {
      console.error("❌ Socket emit failed:", err.message);
    }

    res.status(200).json(existingEtudiant);

  } catch (error) {
    console.error("❌ Error updating student with photo:", error.message);
    res.status(500).json({ message: "Erreur lors de la mise à jour de l'étudiant avec photo" });
  }
}

export async function deleteEtudiant(req, res, next) {
  try {
    const deleted = await Etudiant.findOneAndDelete({ id: req.params.id });

    if (!deleted) {
      return res.status(404).json({ message: "Étudiant non trouvé" });
    }

    // Ensure we have complete user information
    const performedBy = {
      nom: req.user.nom,
      prenom: req.user.prenom,
      role: req.user.role,
      email: req.user.email
    };

    console.log('👤 DELETE Action performed by:', performedBy);

    const payload = {
      id: deleted.id,
      nom: deleted.nom,
      prenom: deleted.prenom,
      email: deleted.email,
      performedBy: performedBy  // Include user info in delete payload
    };

    try {
      const io = getIO();
      console.log('📤 Emitting etudiantDeleted event. Connected clients:', io.engine.clientsCount);
      io.emit("etudiantDeleted", payload);
      console.log('✅ etudiantDeleted event emitted for student ID:', deleted.id);
    } catch (emitErr) {
      console.error("❌ Socket emit failed (etudiantDeleted):", emitErr?.message || emitErr);
    }

    res.status(200).json(deleted);

    await UserAction.create({
      userId: req.user.id,
      actionType: "DELETE",
      targetCollection: "Etudiant",
      targetId: req.params.id,
      description: `Deleted user with ID ${req.params.id}`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });


  } catch (err) {
    next(err);
  }
}

// Check if an email already exists (excluding a specific student by ID)
export async function checkEmailExists(req, res, next) {
  try {
    const { email, excludeId } = req.query;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const query = { email: email };
    if (excludeId) {
      query.id = { $ne: parseInt(excludeId, 10) };
    }

    const existing = await Etudiant.findOne(query);

    res.status(200).json({ exists: !!existing });
  } catch (err) {
    next(err);
  }
}


```

# controllers/logController.js

```js
// controllers/logController.js
import Log from "../models/log.js";
import Etudiant from "../models/etudiant.js";

/**
 * ✅ Save a new log
 */
export async function saveLogs(req, res, next) {
    try {
        const { userId, actionType, etudiant_id, etudiant_name, ip } = req.body;
  
        let entityObjectId = null;
        let entityName = etudiant_name || null;
        
        if (etudiant_id) {
          const etu = await Etudiant.findById(etudiant_id, { _id: 1, nom: 1, prenom: 1 });
          if (etu) {
            entityObjectId = etu._id; // Always store ID if available
            if (!entityName) entityName = `${etu.nom} ${etu.prenom}`; // Only fallback to DB name
          }
        }
        
        // Save log
        const log = await Log.create({
          userId,
          actionType,
          entityId: entityObjectId,
          entityName, // fallback name if student deleted
          ipAddress: ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress,
        });
        
      console.log("log",log);
  
      res.status(200).json({ message: "Log saved successfully", log });
    } catch (error) {
      console.error("❌ Error saving logs:", error.message);
      next(error);
    }
  }
  

/**
 * ✅ Get all logs (for admin panel)
 */
export async function getAllLogs(req, res, next) {
  try {
    const logs = await Log.find()
    .populate("userId", "email nom prenom role")
    .populate("entityId", "nom prenom")
    .sort({ createdAt: -1 });
  
  // ✅ Make sure logs without entityId (deleted student) still appear
  const formattedLogs = logs.map(log => ({
    ...log.toObject(),
    entityFallback: !log.entityId
      ? (log.entityName || '(Deleted Student)')
      : null
  }));
    
  res.status(200).json(formattedLogs);
    } catch (error) {
    next(error);
  }
}

/**
 * ✅ Get logs for a specific user
 */
export async function getUserLogById(req, res, next) {
  try {
    const { userId } = req.body;
    const logs = await Log.find({ userId })
      .populate("userId", "email nom prenom")
      .populate("entityId", "nom prenom")
      .sort({ createdAt: -1 });

    if (!logs.length) {
      return res.status(404).json({ message: "No logs found for this user" });
    }

    res.status(200).json(logs);
  } catch (error) {
    next(error);
  }
}

/**
 * 🗑️ Delete a single log by ID
 */
export async function deleteLog(req, res, next) {
  try {
    const { id } = req.params;
    const deletedLog = await Log.findByIdAndDelete(id);

    if (!deletedLog) {
      return res.status(404).json({ message: "Log not found" });
    }

    res.status(200).json({ message: "Log deleted successfully", deletedLog });
  } catch (error) {
    next(error);
  }
}

/**
 * ⚠️ Delete all logs (admin only)
 */
export async function deleteAllLogs(req, res, next) {
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Access denied: admin only." });
    }

    const result = await Log.deleteMany({});
    res.status(200).json({
      message: `All logs deleted (${result.deletedCount} entries removed).`,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * 🔍 Filter logs by action type (CREATE, UPDATE, DELETE, etc.)
 */
export async function getLogsByActionType(req, res, next) {
    try {
      const { actionType } = req.params;
      
      console.log('🔍 Received actionType:', actionType);
      console.log('🔍 actionType type:', typeof actionType);
  
      const validActions = [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "UPLOAD",
        "DOWNLOAD",
        "OTHER",
      ];
  
      if (!validActions.includes(actionType)) {
        console.log('❌ Invalid actionType:', actionType);
        return res.status(400).json({ message: "Invalid action type" });
      }
  
      console.log('✅ Valid actionType, querying database...');
      
      const logs = await Log.find({ actionType })
        .populate("userId", "email nom prenom")
        .populate("entityId", "nom prenom")
        .sort({ createdAt: -1 });
  
      console.log(`✅ Found ${logs.length} logs for ${actionType}`);
      
      res.status(200).json(logs);
    } catch (error) {
      console.error('❌ Error in getLogsByActionType:', error);
      next(error);
    }
  }
```

# controllers/userController.js

```js
// controllers/userController.js
import User from "../models/user.js";
import jwt from "jsonwebtoken";
import log from "../models/log.js";


// Token JWT
function generateToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Get all users (Admin only)
export async function getAllUsers(req, res, next) {
  try {
    // Check if user is admin from the token
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Accès refusé. Droits administrateur requis." });
    }

    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
}

// Get user by ID (Admin only)
export async function getUserById(req, res, next) {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Accès refusé. Droits administrateur requis." });
    }

    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}

// Update user (Admin only)
export async function updateUser(req, res, next) {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Accès refusé. Droits administrateur requis." });
    }

    const { nom, prenom, email, role } = req.body;

    // Check if email already exists (excluding current user)
    if (email) {
      const existingUser = await User.findOne({ 
        email, 
        _id: { $ne: req.params.id } 
      });
      if (existingUser) {
        return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { nom, prenom, email, role },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.status(200).json(updatedUser);
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
    }
    next(err);
  }
}

// 🗑️ Delete user (Admin only)
export async function deleteUser(req, res, next) {
  try {
    // ✅ Ensure only admins can delete
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Accès refusé. Droits administrateur requis." });
    }

    // 🚫 Prevent admin from deleting their own account
    if (req.user.id === req.params.id) {
      return res.status(400).json({ message: "Vous ne pouvez pas supprimer votre propre compte." });
    }

    // 🔍 Find the user first (for better logging context)
    const userToDelete = await User.findById(req.params.id);
    if (!userToDelete) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // 🗑️ Delete the user
    await User.findByIdAndDelete(req.params.id);

    // 🧾 Log the deletion in UserAction
    await UserAction.create({
      userId: req.user.id, // who performed the action
      actionType: "DELETE",
      targetCollection: "User",
      targetId: req.params.id, // which user was deleted
      description: `L'utilisateur "${req.user.nom} ${req.user.prenom}" a supprimé le compte de "${userToDelete.nom} ${userToDelete.prenom}" (${userToDelete.email}).`,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // ✅ Send response
    res.status(200).json({
      message: `Utilisateur "${userToDelete.nom} ${userToDelete.prenom}" supprimé avec succès.`,
    });

  } catch (err) {
    console.error("❌ Erreur lors de la suppression de l'utilisateur :", err);
    next(err);
  }
}

// Your existing functions remain the same...
export async function register(req, res, next) {
  try {
    const { nom, prenom, email, password, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Utilisateur déjà existant" });
    }

    const user = await User.create({ nom, prenom, email, password, role });

    // Fetch the user again to get the timestamps
    const createdUser = await User.findById(user._id);
    
    res.status(201).json({
      _id: createdUser._id,
      nom: createdUser.nom,
      prenom: createdUser.prenom,
      email: createdUser.email,
      role: createdUser.role,
      createdAt: createdUser.createdAt,
      updatedAt: createdUser.updatedAt,
      token: generateToken(createdUser),
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect" });
    }

    res.status(200).json({
      _id: user._id,
      nom: user.nom,
      prenom: user.prenom,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      token: generateToken(user),
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const { nom, prenom, email } = req.body;

    // Check if trying to update email to an already existing one (exclude current user)
    if (email) {
      const existing = await User.findOne({ email, _id: { $ne: userId } });
      if (existing) {
        return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { nom, prenom, email },
      { new: true, runValidators: true }
    ).select('-password');

    if (!updatedUser) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    res.status(200).json({
      _id: updatedUser._id,
      nom: updatedUser.nom,
      prenom: updatedUser.prenom,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt,
    });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === 11000) {
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
    }
    next(err);
  }
}
```

# index.js

```js
// index.js
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";

import { monRouter } from "./routes/etudiantRouter.js";
import userRouter from "./routes/userRouter.js";
import chatRouter from "./routes/chatRouter.js";
import logsRouter from "./routes/logsRouter.js";

import { pagNotFound } from "./middlewares/pagNotFound.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import path from "path";


const app = express();

app.use(express.json());
app.use(morgan("dev"));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:4200"];


app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true); // Allow tools like Postman
    if (!allowedOrigins.includes(origin)) {
      const msg = `CORS policy: Origin ${origin} not allowed`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));

app.use("/api/users", userRouter);
app.use("/etudiants", monRouter);
app.use("/api/chat", chatRouter);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/logs", logsRouter);



app.use(pagNotFound);
app.use(errorHandler);

export default app;

```

# jest.config.js

```js
// jest.config.js
export default {
    testEnvironment: "node", // obligatoire pour les API Express
    transform: {}, // évite que Jest tente de transformer les fichiers
  };
  
```

# loader.js

```js
// loader.js
import fs from "fs";
import path from "path";

const filePath = path.resolve("etudiants.json");
const etudiants= JSON.parse(fs.readFileSync(filePath,"utf-8"));

export {etudiants};
```

# middlewares/authMiddleware.js

```js
//middlewares/authMiddleware.js

// import jwt from "jsonwebtoken";

// export function protect(req, res, next) {
//   const authHeader = req.headers.authorization;

//   if (authHeader?.startsWith("Bearer ")) {
//     const token = authHeader.split(" ")[1];

//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       req.user = decoded;
//       next();
//     } catch (err) {
//       return res.status(401).json({ message: "Token invalide" });
//     }
//   } else {
//     return res.status(401).json({ message: "Accès non autorisé, token manquant" });
//   }
// }

// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/user.js";

export async function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Fetch the complete user from database using the id from the token
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }
      
      // Set complete user information
      req.user = {
        id: user._id,
        nom: user.nom,
        prenom: user.prenom,
        email: user.email,
        role: user.role
      };
      
      console.log('🔐 Authenticated user:', req.user);
      next();
    } catch (err) {
      console.error('❌ Token verification failed:', err);
      return res.status(401).json({ message: "Token invalide" });
    }
  } else {
    return res.status(401).json({ message: "Accès non autorisé, token manquant" });
  }
}
```

# middlewares/errorHandler.js

```js
// middlewares/errorHandler.js

export function errorHandler(err, req, res, next) {
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
    res.status(statusCode).json({
      message: err.message,
      stack: process.env.NODE_ENV === "production" ? null : err.stack
    });
  }
  
```

# middlewares/pagNotFound.js

```js
// middlewares/notFound.js

export function pagNotFound(req, res, next) {
    res.status(404).json({
      message: "URL Introuvable",
    //   url: req.originalUrl,
    //   method: req.method
    });
  }
  
```

# middlewares/roleMiddleware.js

```js
// middlewares/roleMiddleware.js
export const authorize = (...roles) => {
    return (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          message: "Accès refusé : rôle non autorisé"
        });
      }
      next();
    };
  };
  
```

# middlewares/socketAuth.js

```js
// middlewares/socketAuth.js
import jwt from "jsonwebtoken";
import User from "../models/user.js";

/**
 * Socket authentication middleware.
 * Client must send token in handshake auth: { token: "Bearer <token>" } or raw token.
 *
 * Usage: io.use(socketAuthMiddleware)
 */
export async function socketAuthMiddleware(socket, next) {
  try {
    // If you want to allow anonymous sockets, you can skip when no token is provided.
    const rawToken = socket.handshake?.auth?.token;
    if (!rawToken) {
      // Reject connection if you require auth:
      return next(new Error("Authentication error: token missing"));
      // Or allow anonymous: return next();
    }

    const tokenValue = rawToken.startsWith("Bearer ")
      ? rawToken.split(" ")[1]
      : rawToken;

    const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) {
      return next(new Error("Authentication error: token invalid"));
    }

    // Optionally fetch user from DB and attach to socket
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return next(new Error("Authentication error: user not found"));
    }

    // Attach to socket.data so controllers/handlers can use it
    socket.data.user = user;
    return next();
  } catch (err) {
    console.error("Socket auth error:", err?.message || err);
    return next(new Error("Authentication error"));
  }
}

```

# models/chatMessage.js

```js
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
```

# models/DBConnect.js

```js
//models/DBConnect.js

import mongoose from "mongoose";

export async function DBconnect(){
    try{
        await mongoose.connect(process.env.MONGO_URI);

        console.log("MongoDB connecte");

    }catch(err){
        console.error("Erreur MongoDB", err);
    }
}
```

# models/etudiant.js

```js
//models/etudiant.js
import mongoose from "mongoose";
const etudiantSchema = new mongoose.Schema(

    {
        id:{ type: Number, required: true, unique: true},
        nom:{ type:String,required: true},
        prenom:{type:String,required: true},
        email:{type:String,required: true, unique: true},
        matiere:{type:[String], default: []},
        photo: { type: String, default: null }   // ✅ Add this line


    },
    {timestamps: true}
);

const Etudiant = mongoose.model("Etudiant",etudiantSchema);
export default Etudiant;
```

# models/log.js

```js
// models/log.js
import mongoose from "mongoose";

const logSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actionType: {
      type: String,
      required: true,
      enum: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "UPLOAD",
        "DOWNLOAD",
        "OTHER",
      ],
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,ref : "Etudiant", default: null, 
      
    },
    entityName: {
      type: String,
      default: null,
    },

    ipAddress: {
      type: String,
      required: false,
    }
  },
  { timestamps: true } // adds createdAt & updatedAt
);

const Log = mongoose.model("Log", logSchema);
export default Log;
```

# models/user.js

```js
//models/user.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    nom: { type: String, required: true },
    prenom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: "user" },
  },
  { timestamps: true }
);

// 🔐 Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ✅ Méthode pour comparer les mots de passe
userSchema.methods.comparePassword = async function (inputPassword) {
  return await bcrypt.compare(inputPassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;

```

# package.json

```json
{
  "name": "backend-rest-api",
  "version": "1.0.0",
  "description": "Projet de gestion des etudiants",
  "license": "ISC",
  "author": "Farouk",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js"
  },
  "dependencies": {
    "bcryptjs": "^3.0.2",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "express": "^5.1.0",
    "jsonwebtoken": "^9.0.2",
    "mongoose": "^8.19.0",
    "morgan": "^1.10.1",
    "multer": "^2.0.2",
    "sharp": "^0.34.4",
    "socket.io": "^4.8.1"
  },
  "devDependencies": {
    "jest": "^30.2.0",
    "mongodb-memory-server": "^10.2.3",
    "nodemon": "^3.1.10",
    "supertest": "^7.1.4"
  }
}

```

# routes/chatRouter.js

```js
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
```

# routes/etudiantRouter.js

```js
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
```

# routes/logsRouter.js

```js
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

```

# routes/userRouter.js

```js
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
```

# seed.js

```js
// seed.js
import mongoose from "mongoose";
import Etudiant from "./models/etudiant.js";

// 1. Define sample data
const sampleEtudiants = [
  {
    id: 1,
    nom: "Benali",
    prenom: "Yasmine",
    email: "yasmine.benali@example.com",
    matiere: ["Mathématiques", "Physique", "Chimie"]
  },
  {
    id: 2,
    nom: "Lounis",
    prenom: "Amine",
    email: "amine.lounis@example.com",
    matiere: ["Biologie", "Informatique"]
  },
  {
    id: 3,
    nom: "Mehdi",
    prenom: "Sofia",
    email: "sofia.mehdi@example.com",
    matiere: ["Histoire", "Géographie", "Philosophie"]
  },
  {
    id: 4,
    nom: "Kacem",
    prenom: "Nabil",
    email: "nabil.kacem@example.com",
    matiere: ["Mathématiques", "Informatique"]
  },
  {
    id: 5,
    nom: "Zeroual",
    prenom: "Sarah",
    email: "sarah.zeroual@example.com",
    matiere: ["Anglais", "Espagnol"]
  }
];

// 2. Connect to DB and insert data
async function seed() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/etudiants");
    console.log("✅ Connecté à MongoDB");

    // Optional: clear collection first
    await Etudiant.deleteMany({});
    console.log("🧹 Collection nettoyée");

    // Insert new students
    await Etudiant.insertMany(sampleEtudiants);
    console.log("🎉 Étudiants insérés avec succès");

  } catch (error) {
    console.error("❌ Erreur lors du seed :", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
}

// 3. Run the function
seed();

```

# server.js

```js
// server.js
import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./index.js";
import { DBconnect } from "./models/DBConnect.js";
import { initIO } from "./socket.js";
import { socketAuthMiddleware } from "./middlewares/socketAuth.js";

DBconnect();

const PORT = process.env.PORT || 3000;

// Create HTTP server from the Express app
const server = http.createServer(app);

// Initialize Socket.IO and attach to the http server
const io = initIO(server);

// Install optional socket auth middleware (will validate token on handshake)
try {
  io.use(socketAuthMiddleware);
  console.log("✅ Socket auth middleware installed");
} catch (err) {
  console.warn("⚠️ Failed to install socket auth middleware:", err?.message || err);
}

// ✅ Important: listen on 0.0.0.0 so other devices can reach it
server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server listening at http://0.0.0.0:${PORT}`);
});

```

# socket.js

```js
// socket.js
import { Server as IOServer } from "socket.io";
import jwt from "jsonwebtoken";
import User from "./models/user.js";
import dotenv from "dotenv";
dotenv.config();

let io = null;

// Map<userId, { sockets: Set<string>, user: { userId, nom, prenom, email, role } }>
const onlineUsers = new Map();

export function getOnlineUsersList() {
  return Array.from(onlineUsers.values()).map((entry) => entry.user);
}

// helper to disconnect all sockets for a given userId and clean the map
function disconnectAllSocketsForUser(userId) {
  if (!userId) return;
  const entry = onlineUsers.get(userId.toString());
  if (!entry) return;

  for (const sockId of Array.from(entry.sockets)) {
    const s = io.sockets.sockets.get(sockId);
    if (s) {
      try {
        s.disconnect(true);
      } catch (e) {
        console.warn(`Failed disconnecting socket ${sockId} for user ${userId}:`, e.message);
      }
    }
  }

  onlineUsers.delete(userId.toString());
  io.emit("onlineUsers", getOnlineUsersList());
}

export function initIO(server) {
  if (io) return io;

  const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || process.env.FRONTEND_ORIGIN || "http://localhost:4200")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log("Socket.IO allowed origins:", ALLOWED_ORIGINS);

  io = new IOServer(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        return callback(new Error("Origin not allowed by CORS"));
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  // Authenticate socket handshake
  io.use(async (socket, next) => {
    try {
      let raw = socket.handshake?.auth?.token || socket.handshake?.headers?.authorization || "";
      if (raw && raw.toLowerCase().startsWith("bearer ")) raw = raw.slice(7);
      if (!raw) return next();

      const decoded = jwt.verify(raw, process.env.JWT_SECRET);
      let userObj = null;
      const userId = decoded.id || decoded._id || decoded.userId;

      if (userId) {
        try {
          const user = await User.findById(userId).select("-password").lean();
          if (user) {
            userObj = {
              _id: user._id.toString(),
              nom: user.nom,
              prenom: user.prenom,
              email: user.email,
              role: user.role,
            };
          }
        } catch (err) {
          console.warn("Warning: failed fetching user:", err.message);
        }
      }

      if (!userObj) {
        userObj = {
          _id: userId || decoded._id || decoded.id || null,
          nom: decoded.nom || decoded.name || null,
          prenom: decoded.prenom || null,
          email: decoded.email || null,
          role: decoded.role || null,
        };
      }

      socket.data.user = userObj;
      return next();
    } catch (err) {
      console.log("Socket auth failed:", err.message);
      return next();
    }
  });

  io.on("connection", (socket) => {
    console.log("⚡️ Socket connected:", socket.id);
    const user = socket.data?.user;

    if (user && user._id) {
      const userId = user._id.toString();
      let entry = onlineUsers.get(userId);
      if (!entry) {
        entry = {
          sockets: new Set(),
          user: {
            userId,
            nom: user.nom,
            prenom: user.prenom,
            email: user.email,
            role: user.role,
          },
        };
        onlineUsers.set(userId, entry);
      }
      entry.sockets.add(socket.id);
      console.log(`  -> authenticated as ${user.email || userId} (${user.role || "?"})`);
      io.emit("onlineUsers", getOnlineUsersList());
    } else {
      console.log("  -> unauthenticated socket");
    }

    // 🔹 Handle logout request from client
    socket.on('logout', () => {
        const user = socket.data?.user;
        if (!user || !user._id) return;
      
        const userId = user._id.toString();
        const entry = onlineUsers.get(userId);
        if (entry) {
          entry.sockets.delete(socket.id);
          if (entry.sockets.size === 0) {
            onlineUsers.delete(userId);
          }
          io.emit('onlineUsers', getOnlineUsersList());
          console.log("📡 Broadcasted online users:", getOnlineUsersList().map(u => u.email || u.userId));

        }
      
        console.log(`👋 User ${user.email || userId} logged out.`);
        setTimeout(() => socket.disconnect(true), 100);
    });
            
    socket.on("disconnect", (reason) => {
        setTimeout(() => {
          const u = socket.data?.user;
          if (!u || !u._id) return;
      
          const userId = u._id.toString();
          const entry = onlineUsers.get(userId);
          if (entry) {
            entry.sockets.delete(socket.id);
            if (entry.sockets.size === 0) {
              onlineUsers.delete(userId);
            }
            io.emit("onlineUsers", getOnlineUsersList());
            console.log("📡 Broadcasted online users:", getOnlineUsersList().map(u => u.email || u.userId));

          }
        }, 200); // short delay ensures consistent broadcast order
      });
        });

  return io;
}

export function getIO() {
  if (!io) throw new Error("Socket.IO not initialized. Call initIO(server) first.");
  return io;
}

```

# test/etudiant.auth.test.js

```js
// test/etudiant.auth.test.js
import request from "supertest";
import app from "../index.js";
import { connect, closeDatabase, clearDatabase } from "./setup.js";
import User from "../models/user.js";
import Etudiant from "../models/etudiant.js";

let adminToken;

beforeAll(async () => {
  await connect();

  // Créer un utilisateur admin
  await request(app).post("/api/users/register").send({
    nom: "Admin",
    prenom: "User",
    email: "admin@example.com",
    password: "adminpass",
    role: "admin"
  });

  // Connexion pour obtenir le token
  const loginRes = await request(app).post("/api/users/login").send({
    email: "admin@example.com",
    password: "adminpass"
  });

  adminToken = loginRes.body.token;
});

afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Etudiant API - accès admin", () => {
  it("should create a new etudiant (admin only)", async () => {
    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: 1,
        nom: "Ali",
        prenom: "Farouk",
        email: "farouk@gmail.com",
        matiere: ["Biologie", "Informatique"],
      });

    expect(res.statusCode).toBe(200);
    const etudiant = await Etudiant.findOne({ id: 1 });
    expect(etudiant).not.toBeNull();
  });

  it("should get all etudiants with valid token", async () => {
    await Etudiant.create([
      { id: 1, nom: "Ali", prenom: "Farouk", email: "a@a.com", matiere: ["Math"] },
      { id: 2, nom: "Sara", prenom: "Lina", email: "b@b.com", matiere: ["Physique"] },
    ]);

    const res = await request(app)
      .get("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("should reject access without token", async () => {
    const res = await request(app)
      .post("/etudiants")
      .send({
        id: 3,
        nom: "NoAuth",
        prenom: "User",
        email: "noauth@example.com",
        matiere: [],
      });

    expect(res.statusCode).toBe(401); // Accès refusé
    expect(res.body.message).toMatch(/token/i);
  });

  it("should reject access for non-admin user", async () => {
    // Créer un utilisateur normal
    await request(app).post("/api/users/register").send({
      nom: "Normal",
      prenom: "User",
      email: "user@example.com",
      password: "userpass"
    });

    const loginRes = await request(app).post("/api/users/login").send({
      email: "user@example.com",
      password: "userpass"
    });

    const userToken = loginRes.body.token;

    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        id: 4,
        nom: "Unauthorized",
        prenom: "User",
        email: "unauth@example.com",
        matiere: [],
      });

    expect(res.statusCode).toBe(403); // Refusé
    expect(res.body.message).toMatch(/rôle non autorisé/i);
  });


  it("should update an existing etudiant", async () => {
    await Etudiant.create({
      id: 5,
      nom: "OldName",
      prenom: "OldPrenom",
      email: "old@example.com",
      matiere: ["Math"],
    });

    const res = await request(app)
      .put("/etudiants/5")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ nom: "NewName", matiere: ["Physique"] });

    expect(res.statusCode).toBe(200);
    expect(res.body.nom).toBe("NewName");

    const updated = await Etudiant.findOne({ id: 5 });
    expect(updated.nom).toBe("NewName");
    expect(updated.matiere).toContain("Physique");
  });

  it("should delete an existing etudiant", async () => {
    await Etudiant.create({
      id: 6,
      nom: "ToDelete",
      prenom: "User",
      email: "delete@example.com",
      matiere: [],
    });

    const res = await request(app)
      .delete("/etudiants/6")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);

    const deleted = await Etudiant.findOne({ id: 6 });
    expect(deleted).toBeNull();
  });

  it("should get one etudiant by ID", async () => {
    await Etudiant.create({
      id: 7,
      nom: "Single",
      prenom: "User",
      email: "single@example.com",
      matiere: ["Biologie"],
    });

    const res = await request(app)
      .get("/etudiants/7")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.nom).toBe("Single");
  });

  it("should return 404 when updating non-existing etudiant", async () => {
    const res = await request(app)
      .put("/etudiants/9999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ nom: "NoOne" });

    expect(res.statusCode).toBe(404);
  });

  it("should return 404 when deleting non-existing etudiant", async () => {
    const res = await request(app)
      .delete("/etudiants/9999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should reject creation with missing required fields", async () => {
    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        // Missing id, nom, email etc.
        prenom: "MissingFields",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/requis/i);
  });

  it("should reject creation with duplicate id or email", async () => {
    await Etudiant.create({
      id: 8,
      nom: "Duplicate",
      prenom: "User",
      email: "duplicate@example.com",
      matiere: [],
    });

    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: 8, // duplicate id
        nom: "Duplicate2",
        prenom: "User2",
        email: "duplicate@example.com", // duplicate email
        matiere: [],
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/existe déjà/i);
  });


});

describe("Etudiant API - accès utilisateur normal", () => {
    let userToken;
  
    beforeEach(async () => {
      // Créer un utilisateur "normal"
      await request(app).post("/api/users/register").send({
        nom: "Normal",
        prenom: "User",
        email: "user2@example.com",
        password: "userpass",
        role: "user",
      });
  
      const loginRes = await request(app).post("/api/users/login").send({
        email: "user2@example.com",
        password: "userpass"
      });
  
      userToken = loginRes.body.token;
  
      // Ajouter un étudiant existant
      await Etudiant.create({
        id: 10,
        nom: "EtudiantTest",
        prenom: "Lecture",
        email: "etudiant@test.com",
        matiere: ["Test"]
      });
    });
  
    it("should allow normal user to read all etudiants", async () => {
      const res = await request(app)
        .get("/etudiants")
        .set("Authorization", `Bearer ${userToken}`);
  
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  
    it("should allow normal user to read one etudiant", async () => {
      const res = await request(app)
        .get("/etudiants/10")
        .set("Authorization", `Bearer ${userToken}`);
  
      expect(res.statusCode).toBe(200);
      expect(res.body.nom).toBe("EtudiantTest");
    });
  
    it("should forbid normal user to create etudiant", async () => {
      const res = await request(app)
        .post("/etudiants")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          id: 20,
          nom: "Test",
          prenom: "User",
          email: "test@forbidden.com",
          matiere: ["Math"]
        });
  
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/rôle non autorisé/i);
    });
  
    it("should forbid normal user to update etudiant", async () => {
      const res = await request(app)
        .put("/etudiants/10")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ nom: "Updated" });
  
      expect(res.statusCode).toBe(403);
    });
  
    it("should forbid normal user to delete etudiant", async () => {
      const res = await request(app)
        .delete("/etudiants/10")
        .set("Authorization", `Bearer ${userToken}`);
  
      expect(res.statusCode).toBe(403);
    });
  });
```

# test/etudiant.tttttt.js

```js
// etudiant.test.js

// import request from "supertest";
// import app from "../index.js";
// import { connect, closeDatabase, clearDatabase } from "./setup.js";
// import Etudiant from "../models/etudiant.js";

// beforeAll(async () => await connect());
// afterEach(async () => await clearDatabase());
// afterAll(async () => await closeDatabase());

// describe("Etudiant API", () => {
//   it("should create a new etudiant", async () => {
//     const res = await request(app)
//       .post("/etudiants")
//       .send({
//         id: 1,
//         nom: "Ali",
//         prenom: "Farouk",
//         email: "farouk@gmail.com",
//         matiere: ["Biologie", "Informatique"],
//       });

//     expect(res.statusCode).toBe(200);

//     const etudiant = await Etudiant.findOne({ id: 1 });
//     expect(etudiant).not.toBeNull();
//     expect(etudiant.nom).toBe("Ali");
//     expect(etudiant.matiere).toContain("Biologie");
//   });

//   it("should get all etudiants", async () => {
//     await Etudiant.create([
//       { id: 1, nom: "Ali", prenom: "Farouk", email: "a@a.com", matiere: ["Math"] },
//       { id: 2, nom: "Sara", prenom: "Lina", email: "b@b.com", matiere: ["Physique"] },
//     ]);

//     const res = await request(app).get("/etudiants");

//     expect(res.statusCode).toBe(200);
//     expect(res.body.length).toBe(2);
//   });



//     it("should get an etudiant by id", async () => {
//     const etudiant = await Etudiant.create({
//       id: 1,
//       nom: "Ali",
//       prenom: "Farouk",
//       email: "farouk@gmail.com",
//       matiere: ["Biologie"],
//     });

//     const res = await request(app).get(`/etudiants/${etudiant.id}`);

//     expect(res.statusCode).toBe(200);
//     expect(res.body.nom).toBe("Ali");
//   });


//   it("should update an existing etudiant", async () => {
//     const etudiant = await Etudiant.create({
//       id: 1,
//       nom: "Ali",
//       prenom: "Farouk",
//       email: "farouk@gmail.com",
//       matiere: ["Biologie"],
//     });

//     const res = await request(app)
//       .put(`/etudiants/${etudiant.id}`)
//       .send({ nom: "AliUpdated" });

//     expect(res.statusCode).toBe(200);

//     const updatedEtudiant = await Etudiant.findOne({ id: 1 });
//     expect(updatedEtudiant.nom).toBe("AliUpdated");
//   });


//   it("should delete an etudiant", async () => {
//     const etudiant = await Etudiant.create({
//       id: 1,
//       nom: "Ali",
//       prenom: "Farouk",
//       email: "farouk@gmail.com",
//       matiere: ["Biologie"],
//     });

//     const res = await request(app).delete(`/etudiants/${etudiant.id}`);

//     expect(res.statusCode).toBe(200);

//     const deleted = await Etudiant.findOne({ id: 1 });
//     expect(deleted).toBeNull();
//   });


// });


import request from "supertest";
import app from "../index.js";
import { connect, closeDatabase, clearDatabase } from "./setup.js";
import Etudiant from "../models/etudiant.js";

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Etudiant API", () => {
  it("should create a new etudiant", async () => {
    const res = await request(app)
      .post("/etudiants")
      .send({
        id: 1,
        nom: "Ali",
        prenom: "Farouk",
        email: "farouk@gmail.com",
        matiere: ["Biologie", "Informatique"],
      });

    expect(res.statusCode).toBe(200);

    const etudiant = await Etudiant.findOne({ id: 1 });
    expect(etudiant).not.toBeNull();
    expect(etudiant.nom).toBe("Ali");
    expect(etudiant.matiere).toContain("Biologie");
  });

  it("should get all etudiants", async () => {
    await Etudiant.create([
      { id: 1, nom: "Ali", prenom: "Farouk", email: "a@a.com", matiere: ["Math"] },
      { id: 2, nom: "Sara", prenom: "Lina", email: "b@b.com", matiere: ["Physique"] },
    ]);

    const res = await request(app).get("/etudiants");

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("should get an etudiant by id", async () => {
    const etudiant = await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "farouk@gmail.com",
      matiere: ["Biologie"],
    });

    const res = await request(app).get(`/etudiants/${etudiant.id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.nom).toBe("Ali");
  });

  it("should return 404 when getting non-existing etudiant", async () => {
    const res = await request(app).get(`/etudiants/9999`);

    expect(res.statusCode).toBe(404);
  });

  it("should update an existing etudiant", async () => {
    const etudiant = await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "farouk@gmail.com",
      matiere: ["Biologie"],
    });

    const res = await request(app)
      .put(`/etudiants/${etudiant.id}`)
      .send({ nom: "AliUpdated" });

    expect(res.statusCode).toBe(200);

    const updatedEtudiant = await Etudiant.findOne({ id: 1 });
    expect(updatedEtudiant.nom).toBe("AliUpdated");
  });

  it("should return 404 when updating non-existing etudiant", async () => {
    const res = await request(app)
      .put(`/etudiants/9999`)
      .send({ nom: "AliUpdated" });

    expect(res.statusCode).toBe(404);
  });

  it("should delete an etudiant", async () => {
    const etudiant = await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "farouk@gmail.com",
      matiere: ["Biologie"],
    });

    const res = await request(app).delete(`/etudiants/${etudiant.id}`);

    expect(res.statusCode).toBe(200);

    const deleted = await Etudiant.findOne({ id: 1 });
    expect(deleted).toBeNull();
  });

  it("should return 404 when deleting non-existing etudiant", async () => {
    const res = await request(app).delete(`/etudiants/9999`);

    expect(res.statusCode).toBe(404);
  });

  it("should fail to create etudiant without required fields", async () => {
    const res = await request(app).post("/etudiants").send({
      id: 2,
      prenom: "Farouk", // missing nom and email
    });

    expect(res.statusCode).toBe(500);
  });

  it("should fail to create etudiant with duplicate email", async () => {
    await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "duplicate@gmail.com",
      matiere: [],
    });

    const res = await request(app).post("/etudiants").send({
      id: 2,
      nom: "Sara",
      prenom: "Lina",
      email: "duplicate@gmail.com",
      matiere: [],
    });

    expect(res.statusCode).toBe(500);
  });
});




// import request from "supertest";
// import app from "../index.js";
// import { connect, closeDatabase, clearDatabase } from "./setup.js";
// import Etudiant from "../models/etudiant.js";

// beforeAll(async () => await connect());
// afterEach(async () => await clearDatabase());
// afterAll(async () => await closeDatabase());

// describe("Etudiant API", () => {
//   it("should create a new etudiant", async () => {
//     const res = await request(app)
//       .post("/etudiants")
//       .send({
//         nom: "Ali",
//         prenom: "Farouk",
//         email: "farouk@gmail.com",
//         matiere: ["Biologie", "Informatique"]
//       });

//     expect(res.statusCode).toBe(200); 

//     const etudiant = await Etudiant.findOne({email: "farouk@gmail.com" });
//     expect(etudiant).not.toBeNull();
//     expect(etudiant.nom).toBe("Ali");
//     expect(etudiant.matiere).toContain("Biologie");
//   });
// });

```

# test/setup.js

```js
// test/setup.js

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

export async function connect() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

export async function closeDatabase() {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await mongoServer.stop();
  }
  
  export async function clearDatabase() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  }
  
```

# uploads/1.png

This is a binary file of the type: Image

# uploads/3-Mehdi.jpg

This is a binary file of the type: Image

# uploads/4-Kacemi.jpg

This is a binary file of the type: Image

# uploads/8-testUser.jpg

This is a binary file of the type: Image

# uploads/10-Min hoo.jpg

This is a binary file of the type: Image

# uploads/14-test.jpg

This is a binary file of the type: Image

# uploads/47-Ayaya.jpg

This is a binary file of the type: Image

# uploads/48-Hamdi.jpg

This is a binary file of the type: Image

# uploads/1761560455801.png

This is a binary file of the type: Image

# uploads/1761870943778-therry.png

This is a binary file of the type: Image

