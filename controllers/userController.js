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