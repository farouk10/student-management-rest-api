// test/etudiant.auth.test.js
import request from "supertest";
import app from "../index.js";
import { connect, closeDatabase, clearDatabase } from "./setup.js";
import User from "../models/user.js";
import Etudiant from "../models/etudiant.js";

let adminToken;

beforeAll(async () => {
  await connect();

  // Créer un utilisateur admin
  await request(app).post("/api/users/register").send({
    nom: "Admin",
    prenom: "User",
    email: "admin@example.com",
    password: "adminpass",
    role: "admin"
  });

  // Connexion pour obtenir le token
  const loginRes = await request(app).post("/api/users/login").send({
    email: "admin@example.com",
    password: "adminpass"
  });

  adminToken = loginRes.body.token;
});

afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Etudiant API - accès admin", () => {
  it("should create a new etudiant (admin only)", async () => {
    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: 1,
        nom: "Ali",
        prenom: "Farouk",
        email: "farouk@gmail.com",
        matiere: ["Biologie", "Informatique"],
      });

    expect(res.statusCode).toBe(200);
    const etudiant = await Etudiant.findOne({ id: 1 });
    expect(etudiant).not.toBeNull();
  });

  it("should get all etudiants with valid token", async () => {
    await Etudiant.create([
      { id: 1, nom: "Ali", prenom: "Farouk", email: "a@a.com", matiere: ["Math"] },
      { id: 2, nom: "Sara", prenom: "Lina", email: "b@b.com", matiere: ["Physique"] },
    ]);

    const res = await request(app)
      .get("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("should reject access without token", async () => {
    const res = await request(app)
      .post("/etudiants")
      .send({
        id: 3,
        nom: "NoAuth",
        prenom: "User",
        email: "noauth@example.com",
        matiere: [],
      });

    expect(res.statusCode).toBe(401); // Accès refusé
    expect(res.body.message).toMatch(/token/i);
  });

  it("should reject access for non-admin user", async () => {
    // Créer un utilisateur normal
    await request(app).post("/api/users/register").send({
      nom: "Normal",
      prenom: "User",
      email: "user@example.com",
      password: "userpass"
    });

    const loginRes = await request(app).post("/api/users/login").send({
      email: "user@example.com",
      password: "userpass"
    });

    const userToken = loginRes.body.token;

    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        id: 4,
        nom: "Unauthorized",
        prenom: "User",
        email: "unauth@example.com",
        matiere: [],
      });

    expect(res.statusCode).toBe(403); // Refusé
    expect(res.body.message).toMatch(/rôle non autorisé/i);
  });


  it("should update an existing etudiant", async () => {
    await Etudiant.create({
      id: 5,
      nom: "OldName",
      prenom: "OldPrenom",
      email: "old@example.com",
      matiere: ["Math"],
    });

    const res = await request(app)
      .put("/etudiants/5")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ nom: "NewName", matiere: ["Physique"] });

    expect(res.statusCode).toBe(200);
    expect(res.body.nom).toBe("NewName");

    const updated = await Etudiant.findOne({ id: 5 });
    expect(updated.nom).toBe("NewName");
    expect(updated.matiere).toContain("Physique");
  });

  it("should delete an existing etudiant", async () => {
    await Etudiant.create({
      id: 6,
      nom: "ToDelete",
      prenom: "User",
      email: "delete@example.com",
      matiere: [],
    });

    const res = await request(app)
      .delete("/etudiants/6")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);

    const deleted = await Etudiant.findOne({ id: 6 });
    expect(deleted).toBeNull();
  });

  it("should get one etudiant by ID", async () => {
    await Etudiant.create({
      id: 7,
      nom: "Single",
      prenom: "User",
      email: "single@example.com",
      matiere: ["Biologie"],
    });

    const res = await request(app)
      .get("/etudiants/7")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.nom).toBe("Single");
  });

  it("should return 404 when updating non-existing etudiant", async () => {
    const res = await request(app)
      .put("/etudiants/9999")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ nom: "NoOne" });

    expect(res.statusCode).toBe(404);
  });

  it("should return 404 when deleting non-existing etudiant", async () => {
    const res = await request(app)
      .delete("/etudiants/9999")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(404);
  });

  it("should reject creation with missing required fields", async () => {
    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        // Missing id, nom, email etc.
        prenom: "MissingFields",
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/requis/i);
  });

  it("should reject creation with duplicate id or email", async () => {
    await Etudiant.create({
      id: 8,
      nom: "Duplicate",
      prenom: "User",
      email: "duplicate@example.com",
      matiere: [],
    });

    const res = await request(app)
      .post("/etudiants")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        id: 8, // duplicate id
        nom: "Duplicate2",
        prenom: "User2",
        email: "duplicate@example.com", // duplicate email
        matiere: [],
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toMatch(/existe déjà/i);
  });


});

describe("Etudiant API - accès utilisateur normal", () => {
    let userToken;
  
    beforeEach(async () => {
      // Créer un utilisateur "normal"
      await request(app).post("/api/users/register").send({
        nom: "Normal",
        prenom: "User",
        email: "user2@example.com",
        password: "userpass",
        role: "user",
      });
  
      const loginRes = await request(app).post("/api/users/login").send({
        email: "user2@example.com",
        password: "userpass"
      });
  
      userToken = loginRes.body.token;
  
      // Ajouter un étudiant existant
      await Etudiant.create({
        id: 10,
        nom: "EtudiantTest",
        prenom: "Lecture",
        email: "etudiant@test.com",
        matiere: ["Test"]
      });
    });
  
    it("should allow normal user to read all etudiants", async () => {
      const res = await request(app)
        .get("/etudiants")
        .set("Authorization", `Bearer ${userToken}`);
  
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });
  
    it("should allow normal user to read one etudiant", async () => {
      const res = await request(app)
        .get("/etudiants/10")
        .set("Authorization", `Bearer ${userToken}`);
  
      expect(res.statusCode).toBe(200);
      expect(res.body.nom).toBe("EtudiantTest");
    });
  
    it("should forbid normal user to create etudiant", async () => {
      const res = await request(app)
        .post("/etudiants")
        .set("Authorization", `Bearer ${userToken}`)
        .send({
          id: 20,
          nom: "Test",
          prenom: "User",
          email: "test@forbidden.com",
          matiere: ["Math"]
        });
  
      expect(res.statusCode).toBe(403);
      expect(res.body.message).toMatch(/rôle non autorisé/i);
    });
  
    it("should forbid normal user to update etudiant", async () => {
      const res = await request(app)
        .put("/etudiants/10")
        .set("Authorization", `Bearer ${userToken}`)
        .send({ nom: "Updated" });
  
      expect(res.statusCode).toBe(403);
    });
  
    it("should forbid normal user to delete etudiant", async () => {
      const res = await request(app)
        .delete("/etudiants/10")
        .set("Authorization", `Bearer ${userToken}`);
  
      expect(res.statusCode).toBe(403);
    });
  });