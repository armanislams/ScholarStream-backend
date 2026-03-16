# ScholarStream Backend MVC Migration

This document describes how to convert the existing ScholarStream backend to an MVC structure using MongoDB.

## 1. Goal
- Separate concerns into Model, View, Controller (View is API response layer for Express)
- Centralize DB access
- Make authorization, validation, and error handling easy to manage

## 2. Folder structure

```
ScholarStream-backend/
  src/
    config/
      db.js
      cors.js
      env.js
    models/
      user.model.js
      scholarship.model.js
      application.model.js
      payment.model.js
      review.model.js
      bookmark.model.js
    controllers/
      user.controller.js
      scholarship.controller.js
      application.controller.js
      payment.controller.js
      review.controller.js
      bookmark.controller.js
    routes/
      user.routes.js
      scholarship.routes.js
      application.routes.js
      payment.routes.js
      review.routes.js
      bookmark.routes.js
    middleware/
      auth.middleware.js
      cors.middleware.js
      error.middleware.js
      notFound.middleware.js
    app.js
    server.js
  .env
  package.json
  README.md
```

## 3. Config

`src/config/db.js`
- `connectDB()` initializes MongoClient and returns `db`
- `getCollection(name)` to use from models

`src/config/cors.js`
- use a whitelist from env, allow localhost and production URL

## 4. Models

`models/user.model.js` example:
```js
const getUsers = async () => collection.find().toArray();
const getUserByEmail = async (email) => collection.findOne({ email });
const createUser = async (user) => collection.insertOne(user);
```

## 5. Controllers

`controllers/user.controller.js` example:
```js
const getUserRole = async (req, res, next) => {
  const role = await userModel.getUserRole(req.params.email);
  res.send({ role: role || 'user' });
};
```

## 6. Routes

`routes/user.routes.js` example:
```js
router.get('/:email/role', verifyFirebaseToken, userController.getUserRole);
router.post('/', verifyFirebaseToken, userController.createUser);
```

## 7. Middleware

- `auth.middleware.js` verifies Firebase ID token and sets `req.decoded_email`
- `error.middleware.js` catches errors and sends `res.status(500).json({ message: '...' })`
- `notFound.middleware.js` for 404

## 8. app.js and server.js

`app.js`:
- `app.use(express.json())`
- `app.use(cors(...))`
- `app.use('/users', userRoutes)` etc.
- `app.use(notFound)`
- `app.use(errorHandler)`

`server.js`:
- `require('dotenv').config();`
- `await connectDB();`
- `app.listen(port)`

## 9. Migration steps
1. Introduce new file structure.
2. Move existing route logic from index.js into controllers/models.
3. Keep routes simple and use controller methods.
4. Move JWT/Firebase verification to middleware.
5. Change CORS to env-controlled and include no-slash origin.

## 10. Frontend API base URL
- In frontend `useAxiosSecure.jsx`, switch to env URL: `baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000'`
- Set `VITE_API_URL=https://scholar-stream-791d1-backend.vercel.app`

## 11. Verify + deploy
- `npm run build` in frontend
- Deploy backend + clear cache
- Validate via Postman on deployed URL
