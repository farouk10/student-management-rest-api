// etudiant.test.js

// import request from "supertest";
// import app from "../index.js";
// import { connect, closeDatabase, clearDatabase } from "./setup.js";
// import Etudiant from "../models/etudiant.js";

// beforeAll(async () => await connect());
// afterEach(async () => await clearDatabase());
// afterAll(async () => await closeDatabase());

// describe("Etudiant API", () => {
//   it("should create a new etudiant", async () => {
//     const res = await request(app)
//       .post("/etudiants")
//       .send({
//         id: 1,
//         nom: "Ali",
//         prenom: "Farouk",
//         email: "farouk@gmail.com",
//         matiere: ["Biologie", "Informatique"],
//       });

//     expect(res.statusCode).toBe(200);

//     const etudiant = await Etudiant.findOne({ id: 1 });
//     expect(etudiant).not.toBeNull();
//     expect(etudiant.nom).toBe("Ali");
//     expect(etudiant.matiere).toContain("Biologie");
//   });

//   it("should get all etudiants", async () => {
//     await Etudiant.create([
//       { id: 1, nom: "Ali", prenom: "Farouk", email: "a@a.com", matiere: ["Math"] },
//       { id: 2, nom: "Sara", prenom: "Lina", email: "b@b.com", matiere: ["Physique"] },
//     ]);

//     const res = await request(app).get("/etudiants");

//     expect(res.statusCode).toBe(200);
//     expect(res.body.length).toBe(2);
//   });



//     it("should get an etudiant by id", async () => {
//     const etudiant = await Etudiant.create({
//       id: 1,
//       nom: "Ali",
//       prenom: "Farouk",
//       email: "farouk@gmail.com",
//       matiere: ["Biologie"],
//     });

//     const res = await request(app).get(`/etudiants/${etudiant.id}`);

//     expect(res.statusCode).toBe(200);
//     expect(res.body.nom).toBe("Ali");
//   });


//   it("should update an existing etudiant", async () => {
//     const etudiant = await Etudiant.create({
//       id: 1,
//       nom: "Ali",
//       prenom: "Farouk",
//       email: "farouk@gmail.com",
//       matiere: ["Biologie"],
//     });

//     const res = await request(app)
//       .put(`/etudiants/${etudiant.id}`)
//       .send({ nom: "AliUpdated" });

//     expect(res.statusCode).toBe(200);

//     const updatedEtudiant = await Etudiant.findOne({ id: 1 });
//     expect(updatedEtudiant.nom).toBe("AliUpdated");
//   });


//   it("should delete an etudiant", async () => {
//     const etudiant = await Etudiant.create({
//       id: 1,
//       nom: "Ali",
//       prenom: "Farouk",
//       email: "farouk@gmail.com",
//       matiere: ["Biologie"],
//     });

//     const res = await request(app).delete(`/etudiants/${etudiant.id}`);

//     expect(res.statusCode).toBe(200);

//     const deleted = await Etudiant.findOne({ id: 1 });
//     expect(deleted).toBeNull();
//   });


// });


import request from "supertest";
import app from "../index.js";
import { connect, closeDatabase, clearDatabase } from "./setup.js";
import Etudiant from "../models/etudiant.js";

beforeAll(async () => await connect());
afterEach(async () => await clearDatabase());
afterAll(async () => await closeDatabase());

describe("Etudiant API", () => {
  it("should create a new etudiant", async () => {
    const res = await request(app)
      .post("/etudiants")
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
    expect(etudiant.nom).toBe("Ali");
    expect(etudiant.matiere).toContain("Biologie");
  });

  it("should get all etudiants", async () => {
    await Etudiant.create([
      { id: 1, nom: "Ali", prenom: "Farouk", email: "a@a.com", matiere: ["Math"] },
      { id: 2, nom: "Sara", prenom: "Lina", email: "b@b.com", matiere: ["Physique"] },
    ]);

    const res = await request(app).get("/etudiants");

    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it("should get an etudiant by id", async () => {
    const etudiant = await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "farouk@gmail.com",
      matiere: ["Biologie"],
    });

    const res = await request(app).get(`/etudiants/${etudiant.id}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.nom).toBe("Ali");
  });

  it("should return 404 when getting non-existing etudiant", async () => {
    const res = await request(app).get(`/etudiants/9999`);

    expect(res.statusCode).toBe(404);
  });

  it("should update an existing etudiant", async () => {
    const etudiant = await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "farouk@gmail.com",
      matiere: ["Biologie"],
    });

    const res = await request(app)
      .put(`/etudiants/${etudiant.id}`)
      .send({ nom: "AliUpdated" });

    expect(res.statusCode).toBe(200);

    const updatedEtudiant = await Etudiant.findOne({ id: 1 });
    expect(updatedEtudiant.nom).toBe("AliUpdated");
  });

  it("should return 404 when updating non-existing etudiant", async () => {
    const res = await request(app)
      .put(`/etudiants/9999`)
      .send({ nom: "AliUpdated" });

    expect(res.statusCode).toBe(404);
  });

  it("should delete an etudiant", async () => {
    const etudiant = await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "farouk@gmail.com",
      matiere: ["Biologie"],
    });

    const res = await request(app).delete(`/etudiants/${etudiant.id}`);

    expect(res.statusCode).toBe(200);

    const deleted = await Etudiant.findOne({ id: 1 });
    expect(deleted).toBeNull();
  });

  it("should return 404 when deleting non-existing etudiant", async () => {
    const res = await request(app).delete(`/etudiants/9999`);

    expect(res.statusCode).toBe(404);
  });

  it("should fail to create etudiant without required fields", async () => {
    const res = await request(app).post("/etudiants").send({
      id: 2,
      prenom: "Farouk", // missing nom and email
    });

    expect(res.statusCode).toBe(500);
  });

  it("should fail to create etudiant with duplicate email", async () => {
    await Etudiant.create({
      id: 1,
      nom: "Ali",
      prenom: "Farouk",
      email: "duplicate@gmail.com",
      matiere: [],
    });

    const res = await request(app).post("/etudiants").send({
      id: 2,
      nom: "Sara",
      prenom: "Lina",
      email: "duplicate@gmail.com",
      matiere: [],
    });

    expect(res.statusCode).toBe(500);
  });
});




// import request from "supertest";
// import app from "../index.js";
// import { connect, closeDatabase, clearDatabase } from "./setup.js";
// import Etudiant from "../models/etudiant.js";

// beforeAll(async () => await connect());
// afterEach(async () => await clearDatabase());
// afterAll(async () => await closeDatabase());

// describe("Etudiant API", () => {
//   it("should create a new etudiant", async () => {
//     const res = await request(app)
//       .post("/etudiants")
//       .send({
//         nom: "Ali",
//         prenom: "Farouk",
//         email: "farouk@gmail.com",
//         matiere: ["Biologie", "Informatique"]
//       });

//     expect(res.statusCode).toBe(200); 

//     const etudiant = await Etudiant.findOne({email: "farouk@gmail.com" });
//     expect(etudiant).not.toBeNull();
//     expect(etudiant.nom).toBe("Ali");
//     expect(etudiant.matiere).toContain("Biologie");
//   });
// });
