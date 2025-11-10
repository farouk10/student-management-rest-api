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
