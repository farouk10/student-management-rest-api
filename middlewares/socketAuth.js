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
