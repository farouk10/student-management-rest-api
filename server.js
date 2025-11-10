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
