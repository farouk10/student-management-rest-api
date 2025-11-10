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