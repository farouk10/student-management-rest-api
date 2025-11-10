# Gestionnaire d'Étudiants — API Backend

**Résumé**  
API REST complète pour la gestion d'étudiants développée avec Node.js, Express et MongoDB. Fonctionnalités : authentification JWT, CRUD avec upload de photos (Multer), pagination, recherche, notifications temps réel (Socket.IO), et système d'audit/logging.

---

## Table des matières
- Technos   
- Fonctionnalités
- Prérequis
- Installation 
- Configuration
- Lancer le serveur
- Structure du projet  
- Endpoints API 
- Authentification 
- Upload de fichiers  
- Socket.IO
- Système de logs
- Tests
- Déploiement
- Dépannage 
- Bonnes pratiques
- Contribuer
- Licence

---

## Technos
- **Node.js** & **Express** - Serveur et API REST
- **MongoDB** & **Mongoose** - Base de données NoSQL
- **JWT** (jsonwebtoken) - Authentification
- **Multer** - Upload de fichiers
- **Socket.IO** - Communication temps réel
- **bcrypt** - Hashage des mots de passe
- **cors** - Gestion des origines cross-domain
- **dotenv** - Variables d'environnement

---

## Fonctionnalités
- ✅ API REST complète avec Express
- ✅ Authentification JWT (register/login)
- ✅ CRUD complet pour les étudiants
- ✅ Upload de photos avec Multer
- ✅ Fichiers statiques servis sur `/uploads`
- ✅ Pagination et recherche
- ✅ IDs auto-incrémentés pour les étudiants
- ✅ Socket.IO pour notifications temps réel
- ✅ Système d'audit avec logs des actions
- ✅ Gestion des rôles (admin/user)
- ✅ Middleware d'authentification
- ✅ CORS configuré

---

## Prérequis
- Node.js (version 14+ recommandée)
- npm ou yarn
- MongoDB (local ou Atlas cloud)
- Postman ou curl pour tester l'API (optionnel)

---

## Installation

```bash
# Cloner le repository
git clone https://github.com/farouk10/student-management-api.git
cd student-management-api

# Installer les dépendances
npm install
```

---

## Configuration

### Variables d'environnement

Créer un fichier `.env` à la racine :

```env
# Serveur
PORT=3000
NODE_ENV=development

# Base de données
MONGO_URI=mongodb://127.0.0.1:27017/etudiants
# Ou pour MongoDB Atlas :
# MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/etudiants

# JWT
JWT_SECRET=VotreCleSecreteTresFortePourJWT2024!

# CORS - Frontend
FRONTEND_ORIGIN=http://localhost:4200
ALLOWED_ORIGINS=http://localhost:4200,http://192.168.31.94:4200

# URL de base (optionnel)
BACKEND_BASE_URL=http://localhost:3000
```

**⚠️ Important :** Ne jamais commit le fichier `.env` ! Ajoutez-le dans `.gitignore`.

---

## Lancer le serveur

### Mode développement (avec nodemon)

```bash
npm run dev
```

### Mode production

```bash
npm start
```

Le serveur démarre sur `http://localhost:3000` (ou le PORT défini dans `.env`)

---

## Structure du projet

```
backend/
├── controllers/              # Logique métier
│   ├── authController.js
│   ├── etudiantController.js
│   └── logController.js
├── models/                   # Modèles Mongoose
│   ├── User.js
│   ├── Etudiant.js
│   ├── Counter.js
│   └── Log.js
├── routes/                   # Routes Express
│   ├── authRoutes.js
│   ├── etudiantRoutes.js
│   └── logRoutes.js
├── middleware/               # Middlewares
│   ├── authMiddleware.js
│   └── adminMiddleware.js
├── config/                   # Configuration
│   └── db.js
├── uploads/                  # Dossier des photos uploadées
├── socket.js                 # Configuration Socket.IO
├── index.js                  # Point d'entrée
├── .env                      # Variables d'environnement
├── .gitignore
└── package.json
```

---

## Endpoints API

### Authentification

| Méthode | Endpoint | Description | Auth requise |
|---------|----------|-------------|--------------|
| POST | `/api/users/register` | Créer un compte | Non |
| POST | `/api/users/login` | Se connecter | Non |

**Exemple de body (login) :**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Réponse :**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

---

### Étudiants

| Méthode | Endpoint | Description | Auth | Admin |
|---------|----------|-------------|------|-------|
| GET | `/etudiants` | Liste des étudiants | ✅ | Non |
| GET | `/etudiants/:id` | Détails d'un étudiant | ✅ | Non |
| POST | `/etudiants` | Créer (JSON) | ✅ | ✅ |
| POST | `/etudiants/add-with-photo` | Créer avec photo | ✅ | ✅ |
| PUT | `/etudiants/:id` | Modifier (JSON) | ✅ | ✅ |
| PUT | `/etudiants/:id` (multipart) | Modifier avec photo | ✅ | ✅ |
| DELETE | `/etudiants/:id` | Supprimer | ✅ | ✅ |

**Query params pour GET `/etudiants` :**
- `page` (default: 1)
- `limit` (default: 10)
- `search` (recherche par nom/prénom/email)

**Exemple :**
```
GET /etudiants?page=1&limit=10&search=John
```

---

### Logs (Audit)

| Méthode | Endpoint | Description | Auth | Admin |
|---------|----------|-------------|------|-------|
| POST | `/logs` | Créer un log | ✅ | Non |
| GET | `/logs` | Liste des logs | ✅ | ✅ |
| GET | `/logs/type/:actionType` | Filtrer par type | ✅ | ✅ |

**Types d'actions :** `CREATE`, `UPDATE`, `DELETE`

---

### Fichiers statiques

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/uploads/:filename` | Accéder aux photos |

**Exemple :**
```
http://localhost:3000/uploads/photo-1699876543210.jpg
```

---

## Authentification

Toutes les routes protégées nécessitent un token JWT dans l'en-tête :

```
Authorization: Bearer <votre_token_jwt>
```

Le middleware `authMiddleware.js` vérifie le token et ajoute `req.user` avec les infos de l'utilisateur.

---

## Upload de fichiers

### Configuration Multer

Le serveur accepte les uploads avec le champ `photo` :
- Format accepté : `.jpg`, `.jpeg`, `.png`
- Taille max : 5MB (configurable)
- Stockage : dossier `/uploads`

### Créer un étudiant avec photo

**Endpoint :** `POST /etudiants/add-with-photo`

**Content-Type :** `multipart/form-data`

**Champs :**
- `nom` (string)
- `prenom` (string)
- `email` (string)
- `matiere` (array JSON stringifié : `["Math","Physique"]`)
- `photo` (file)

**Exemple avec curl :**
```bash
curl -X POST "http://localhost:3000/etudiants/add-with-photo" \
  -H "Authorization: Bearer <TOKEN>" \
  -F "nom=Dupont" \
  -F "prenom=Jean" \
  -F "email=jean.dupont@example.com" \
  -F "matiere=[\"Math\",\"Informatique\"]" \
  -F "photo=@/chemin/vers/photo.jpg"
```

**Exemple avec JavaScript/FormData :**
```javascript
const formData = new FormData();
formData.append('nom', 'Dupont');
formData.append('prenom', 'Jean');
formData.append('email', 'jean.dupont@example.com');
formData.append('matiere', JSON.stringify(['Math', 'Informatique']));
formData.append('photo', fileInput.files[0]);

fetch('http://localhost:3000/etudiants/add-with-photo', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
    // Ne PAS définir Content-Type manuellement
  },
  body: formData
});
```

---

## Socket.IO

### Connexion client

Le client doit envoyer le token JWT lors de la connexion :

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'Bearer <votre_token>'
  }
});
```

### Événements serveur → client

| Événement | Description | Données |
|-----------|-------------|---------|
| `onlineUsers` | Liste des utilisateurs connectés | `{ users: [...] }` |
| `etudiantCreated` | Nouvel étudiant créé | `{ etudiant: {...} }` |
| `etudiantUpdated` | Étudiant modifié | `{ etudiant: {...} }` |
| `etudiantDeleted` | Étudiant supprimé | `{ id: "..." }` |
| `newChatMessage` | Nouveau message chat | `{ message: {...} }` |

### Événements client → serveur

| Événement | Description |
|-----------|-------------|
| `logout` | Déconnecter l'utilisateur |
| `sendMessage` | Envoyer un message (si chat) |

---

## Système de logs

### Modèle Log

```javascript
{
  userId: ObjectId,          // Utilisateur qui a effectué l'action
  actionType: String,        // CREATE, UPDATE, DELETE
  entityId: ObjectId,        // ID de l'étudiant concerné
  entityType: String,        // "Etudiant"
  entitySnapshot: Object,    // Snapshot des données (optionnel)
  timestamp: Date
}
```

### Enregistrer un log

Le frontend envoie automatiquement un log après chaque action via l'intercepteur.

**Endpoint :** `POST /logs`

**Body :**
```json
{
  "actionType": "CREATE",
  "entityId": "507f1f77bcf86cd799439011",
  "entityType": "Etudiant",
  "details": "Création de l'étudiant Jean Dupont"
}
```

---

## Tests

### Tests manuels avec Postman

1. Importer la collection Postman (à créer)
2. Tester les endpoints un par un
3. Vérifier les codes de statut HTTP

### Tests automatisés (recommandé)

Utiliser **Jest** et **Supertest** :

```bash
npm install --save-dev jest supertest

# Ajouter dans package.json
"scripts": {
  "test": "jest"
}

# Lancer les tests
npm test
```

**Exemple de test :**
```javascript
const request = require('supertest');
const app = require('./index');

describe('POST /api/users/login', () => {
  it('should return token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/users/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});
```

---

## Déploiement

### Options de déploiement

1. **Heroku**
2. **Railway**
3. **Render**
4. **DigitalOcean**
5. **AWS / Azure / GCP**

### Checklist pré-déploiement

- ✅ Variables d'environnement configurées
- ✅ MongoDB Atlas connecté (si cloud)
- ✅ `NODE_ENV=production`
- ✅ CORS configuré avec la bonne origine frontend
- ✅ Dossier `uploads/` configuré ou remplacé par S3
- ✅ HTTPS activé
- ✅ Rate limiting ajouté (express-rate-limit)
- ✅ Logs de production configurés (Winston)

### Exemple avec PM2

```bash
npm install -g pm2

# Démarrer l'application
pm2 start index.js --name "student-api"

# Voir les logs
pm2 logs

# Redémarrer
pm2 restart student-api
```

---

## Dépannage

### MongoDB ne se connecte pas

- Vérifier que MongoDB est démarré : `mongod`
- Vérifier `MONGO_URI` dans `.env`
- Pour Atlas : vérifier les whitelist IP

### Photos ne se sauvent pas

- Vérifier que le dossier `uploads/` existe
- Vérifier les permissions du dossier
- Vérifier que le champ `photo` est bien dans le modèle Mongoose
- Vérifier le code du controller : `req.file.filename`

### Token JWT invalide

- Vérifier que `JWT_SECRET` est défini
- Vérifier le format : `Bearer <token>`
- Vérifier l'expiration du token

### CORS bloqué

- Ajouter l'origine du frontend dans `ALLOWED_ORIGINS`
- Vérifier la configuration CORS dans `index.js`

---

## Bonnes pratiques

### Sécurité

1. **Toujours hasher les mots de passe** (bcrypt)
2. **Valider les entrées** utilisateur (express-validator)
3. **Limiter les requêtes** (express-rate-limit)
4. **Utiliser HTTPS** en production
5. **Sécuriser les uploads** (vérifier MIME type, limiter la taille)
6. **Ne jamais exposer les secrets** dans le code
7. **Utiliser helmet.js** pour les headers de sécurité

### Performance

1. **Indexer les champs** MongoDB fréquemment recherchés
2. **Paginer** les résultats
3. **Mettre en cache** avec Redis (optionnel)
4. **Compresser** les réponses (compression middleware)
5. **Utiliser PM2** en mode cluster

### Stockage des fichiers

Pour la production, remplacer le stockage local par :
- **AWS S3**
- **Cloudinary**
- **Google Cloud Storage**

---

## Contribuer

1. Fork le projet
2. Créer une branche (`git checkout -b feature/nouvelle-fonctionnalite`)
3. Commit les changements (`git commit -m 'Ajout nouvelle fonctionnalité'`)
4. Push vers la branche (`git push origin feature/nouvelle-fonctionnalite`)
5. Ouvrir une Pull Request

---

## Licence

Ce projet est distribué sous la licence [MIT](./LICENSE).

---

## Auteur

**Farouk Talha**  
- GitHub : [@farouk10](https://github.com/farouk10)
- Repo Frontend : [student-management-frontend](https://github.com/farouk10/student-management-frontend)

---

## Frontend requis

Cette API est conçue pour fonctionner avec le frontend suivant :  
👉 [student-management-frontend](https://github.com/farouk10/student-management-frontend)

Consultez la documentation du frontend pour l'intégration complète.
