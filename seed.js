// seed.js
import mongoose from "mongoose";
import Etudiant from "./models/etudiant.js";

// 1. Define sample data
const sampleEtudiants = [
  {
    id: 1,
    nom: "Benali",
    prenom: "Yasmine",
    email: "yasmine.benali@example.com",
    matiere: ["Mathématiques", "Physique", "Chimie"]
  },
  {
    id: 2,
    nom: "Lounis",
    prenom: "Amine",
    email: "amine.lounis@example.com",
    matiere: ["Biologie", "Informatique"]
  },
  {
    id: 3,
    nom: "Mehdi",
    prenom: "Sofia",
    email: "sofia.mehdi@example.com",
    matiere: ["Histoire", "Géographie", "Philosophie"]
  },
  {
    id: 4,
    nom: "Kacem",
    prenom: "Nabil",
    email: "nabil.kacem@example.com",
    matiere: ["Mathématiques", "Informatique"]
  },
  {
    id: 5,
    nom: "Zeroual",
    prenom: "Sarah",
    email: "sarah.zeroual@example.com",
    matiere: ["Anglais", "Espagnol"]
  }
];

// 2. Connect to DB and insert data
async function seed() {
  try {
    await mongoose.connect("mongodb://127.0.0.1:27017/etudiants");
    console.log("✅ Connecté à MongoDB");

    // Optional: clear collection first
    await Etudiant.deleteMany({});
    console.log("🧹 Collection nettoyée");

    // Insert new students
    await Etudiant.insertMany(sampleEtudiants);
    console.log("🎉 Étudiants insérés avec succès");

  } catch (error) {
    console.error("❌ Erreur lors du seed :", error.message);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Déconnecté de MongoDB");
  }
}

// 3. Run the function
seed();
