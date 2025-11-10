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