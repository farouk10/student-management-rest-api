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