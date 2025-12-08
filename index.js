const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 3000;
const crypto = require("crypto");
const admin = require("firebase-admin");

//middleware
app.use(express.json());
app.use(cors());

//verify user
const verifyFirebaseToken = async (req, res, next) => {
  const token = req.headers.authorization;
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  try {
    const idToken = token.split(" ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);
    // console.log('decoded token', decoded);
    req.decoded_email = decoded.email;
    next();
  } catch (err) {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

//mongodb

const uri = `mongodb+srv://${process.env.MONGO_DB_USER}:${process.env.MONGO_DB_PASS}@${process.env.MONGO_DB_URI}`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
    // Connect the client to the server	(optional starting in v4.7)
    client.connect();
     const db = client.db("scholar-stream");
    const userCollection = db.collection("users");
    

    ///users
         app.post("/users", async (req, res) => {
              const user = req.body;
              user.role = "user";
              user.createdAt = new Date();
              const email = user.email;
              const userExist = await userCollection.findOne({ email });
              if (userExist) {
                return res.send({ message: "user exist" });
              }
              const result = await userCollection.insertOne(user);
              res.send(result);
            });
        
            app.get("/users", async (req, res) => {
              const searchText = req.query.searchText;
              const query = {};
              if (searchText) {
                query.$or = [
                  { displayName: { $regex: searchText, $options: "i" } },
                  { email: { $regex: searchText, $options: "i" } },
                ];
              }
              const result = await userCollection.find(query).sort({ createdAt: -1 }).toArray();
              res.send(result);
            });
        
            // app.get("/users/:id", async (req, res) => {});
        
            app.get("/users/:email/role",async (req, res) => {
                const email = req.params.email;
                const query = { email };
                const user = await userCollection.findOne(query);
                res.send({ role: user?.role || "user" });
              }
            );
        
            app.patch("/users/:id/role",async (req, res) => {
                const id = req.params.id;
                const roleInfo = req.body;
                const query = { _id: new ObjectId(id) };
                const updateDoc = {
                  $set: {
                    role: roleInfo.role,
                  },
                };
                const result = await userCollection.updateOne(query, updateDoc);
                res.send(result);
              }
            );
        








    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("ZapShift Server");
});

app.listen(port, () => {
  console.log("port running on", port);
});