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

