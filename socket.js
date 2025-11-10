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
