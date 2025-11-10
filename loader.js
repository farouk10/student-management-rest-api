// loader.js
import fs from "fs";
import path from "path";

const filePath = path.resolve("etudiants.json");
const etudiants= JSON.parse(fs.readFileSync(filePath,"utf-8"));

export {etudiants};