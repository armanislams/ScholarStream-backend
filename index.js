const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
const port = process.env.PORT || 3000;
const crypto = require("crypto");

///FIREBASE SERVICE ACCOUNT 
const admin = require("firebase-admin");
const decoded = Buffer.from(process.env.FIREBASE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

//middleware
app.use(express.json());
app.use(cors());

//userID
function generateUserId() {
  const prefix = "SS";
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, ""); //YYYYMMDD
  const random = crypto.randomBytes(1).toString("hex").toUpperCase(); //6-char random hex
  return `${prefix}-${date}-${random}`;
}

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
    console.log(err);

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
  const scholarshipsCollection = db.collection("scholarships");
  const applicationsCollection = db.collection("applications");
  const paymentCollection = db.collection("payments");
  const reviewsCollection = db.collection("reviews");

  //verify user roles
  const verifyAdmin = async (req, res, next) => {
    const allowedRoles = ["admin", "super-admin"];
    const email = req.decoded_email;
    const query = { email };
    const user = await userCollection.findOne(query);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    next();
  };
  const verifyModerator = async (req, res, next) => {
    const allowedRoles = ["moderator", "super-admin"];
    const email = req.decoded_email;
    const query = { email };
    const user = await userCollection.findOne(query);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).send({ message: "Forbidden access" });
    }

    next();
  };

  ///users
  app.post("/users", async (req, res) => {
    const user = req.body;
    user.role = "student";
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
    const result = await userCollection
      .find(query)
      .sort({ createdAt: -1 })
      .toArray();
    res.send(result);
  });

  app.get("/users/:email", verifyFirebaseToken, async (req, res) => {
    const email = req.params.email;
    const query = { email };
    const result = await userCollection.findOne(query);
    res.send(result);
    // console.log(result);
  });

  app.get("/users/:email/role", verifyFirebaseToken, async (req, res) => {
    const email = req.params.email;
    const query = { email };
    const user = await userCollection.findOne(query);
    res.send({ role: user?.role || "user" });
  });

  app.patch("/users/:id/role", verifyFirebaseToken, async (req, res) => {
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
  });

  app.delete("/users/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await userCollection.deleteOne(query);
    res.send(result);
  });

  // scholarship api
  app.get("/scholarships", verifyFirebaseToken, async (req, res) => {
    const searchText = req.query.searchText;
    const {
      email,
      scholarshipCategory,
      subjectCategory,
      universityCountry,
      page = 1,
      limit = 12,
    } = req.query;

    let query = {};
    const filterConditions = [];

    // Search functionality (OR condition across multiple fields)
    if (searchText) {
      filterConditions.push({
        $or: [
          { scholarshipName: { $regex: searchText, $options: "i" } },
          { universityName: { $regex: searchText, $options: "i" } },
          { degree: { $regex: searchText, $options: "i" } },
          { subjectCategory: { $regex: searchText, $options: "i" } },
          { scholarshipCategory: { $regex: searchText, $options: "i" } },
          { universityCountry: { $regex: searchText, $options: "i" } },
        ],
      });
    }

    // Filter by scholarship category (exact match)
    if (scholarshipCategory) {
      filterConditions.push({ scholarshipCategory: scholarshipCategory });
    }

    // Filter by subject category (exact match)
    if (subjectCategory) {
      filterConditions.push({ subjectCategory: subjectCategory });
    }

    // Filter by university country/location (exact match)
    if (universityCountry) {
      filterConditions.push({ universityCountry: universityCountry });
    }

    // Scholarship by email
    if (email) {
      filterConditions.push({ senderEmail: email });
    }

    // Combine all conditions with AND logic
    if (filterConditions.length > 0) {
      query.$and = filterConditions;
    }

    // Pagination calculations
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await scholarshipsCollection.countDocuments(query);

    // Get paginated results
    // Sorting
    let sortOptions = { createdAt: -1 };
    if (req.query.sortType === "feesAsc") {
      sortOptions = { applicationFees: 1 };
    } else if (req.query.sortType === "feesDesc") {
      sortOptions = { applicationFees: -1 };
    } else if (req.query.sortType === "dateAsc") {
      sortOptions = { scholarshipPostDate: 1 };
    } else if (req.query.sortType === "dateDesc") {
      sortOptions = { scholarshipPostDate: -1 };
    }

    const options = { sort: sortOptions };
    const result = await scholarshipsCollection
      .find(query, options)
      .skip(skip)
      .limit(limitNum)
      .toArray();

    // Send response with pagination metadata
    res.send({
      data: result,
      totalCount: totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
      pageSize: limitNum,
    });
  });

  app.get("/scholarships/top", async (req, res) => {
    const result = await scholarshipsCollection
      .find()
      .sort({ scholarshipPostDate: -1 })
      .limit(6)
      .toArray();
    res.send(result);
  });

  app.get("/scholarships/:id", verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await scholarshipsCollection.findOne(query);
    res.send(result);
  });

  app.post("/scholarships", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const scholarship = req.body;
    scholarship.createdAt = new Date();
    scholarship.scholarshipPostDate = new Date();
    const result = await scholarshipsCollection.insertOne(scholarship);
    res.send(result);
  });

  app.patch("/scholarships/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const scholarship = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = { $set: scholarship };
    const result = await scholarshipsCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  app.delete("/scholarships/:id", verifyFirebaseToken, verifyAdmin, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await scholarshipsCollection.deleteOne(query);
    res.send(result);
  });

  app.post("/apply-scholarships", verifyFirebaseToken, async (req, res) => {
    const applicationData = req.body;
    const userId = generateUserId();
    applicationData.userId = userId;
    applicationData.applicationDate = new Date();
    const result = await applicationsCollection.insertOne(applicationData);
    res.send(result);
  });
  app.get("/applications", verifyFirebaseToken, async (req, res) => {
    const result = await applicationsCollection.find().toArray();
    res.send(result);
  });
  app.get("/applied-scholarships/:email", verifyFirebaseToken,
    async (req, res) => {
      const email = req.params.email;
      if (req.decoded_email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { userEmail: email };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    }
  );

  // scholarship payment checkout API
  app.post("/scholarship-payment-checkout", async (req, res) => {
    const paymentInfo = req.body;
    console.log(paymentInfo);

    const payment = parseInt(paymentInfo.charge) * 100;
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          // Provide the exact Price ID (for example, price_1234) of the product you want to sell
          price_data: {
            currency: "USD",
            unit_amount: payment,
            product_data: {
              name: paymentInfo.universityName,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: paymentInfo.studentEmail,
      metadata: {
        universityName: paymentInfo.universityName,
        scholarshipId: paymentInfo.scholarshipId,
        applicationId: paymentInfo.applicationId,
      },
      success_url: `${process.env.SITE_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}/payment-cancelled`,
    });
    console.log(session);
    res.send({ url: session.url });
  });
  app.patch("/payment-success", verifyFirebaseToken, async (req, res) => {
    const sessionId = req.query.session_id;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    // console.log('session retrieve', session);

    const transactionId = session.payment_intent;
    const query = {
      transactionId: transactionId,
    };
    const paymentExist = await paymentCollection.findOne(query);

    if (paymentExist) {
      return res.send({
        message: "already exist",
      });
    }

    if (session.payment_status === "paid") {
      const applicationId = session.metadata.applicationId;
      const query = { _id: new ObjectId(applicationId) };
      const update = {
        $set: {
          paymentStatus: "paid",
        },
      };
      const result = await applicationsCollection.updateOne(query, update);
      const payment = {
        amount: session.amount_total / 100,
        email: session.customer_email,
        scholarshipId: session.metadata.scholarshipId,
        universityName: session.metadata.universityName,
        transactionId: session.payment_intent,
        paymentStatus: session.payment_status,
        paidAt: new Date(),
      };
      const resultPayment = await paymentCollection.insertOne(payment);

      //   console.log(resultPayment);
      return res.send({
        success: true,
        result,
        payment,
        resultPayment,
      });
    }
    return res.send({ success: false });
  });

  app.get("/payments", verifyFirebaseToken, async (req, res) => {
    const email = req.query.email;
    // console.log('headers',req.headers);
    const query = {};

    if (email) {
      query.email = email;
      //check email
      if (email !== req.decoded_email) {
        return res.status(403).send({ message: "forbidden access" });
      }
    }
    const options = { sort: { paidAt: -1 } };
    const cursor = paymentCollection.find();
    const result = await cursor.toArray();
    res.send(result);
  });
  // Analytics
  app.get(
    "/analytics/admin-stats",
    verifyFirebaseToken,
    verifyAdmin,
    async (req, res) => {
      const totalUsers = await userCollection.countDocuments();
      const totalScholarships = await scholarshipsCollection.countDocuments();
      const totalApplications = await applicationsCollection.countDocuments();
      const totalPayments = await paymentCollection
        .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
        .toArray();
      const totalFees = totalPayments.length > 0 ? totalPayments[0].total : 0;

      res.send({ totalUsers, totalScholarships, totalApplications, totalFees });
    }
  );

  app.get(
    "/analytics/student-stats/:email",
    verifyFirebaseToken,
    async (req, res) => {
      const email = req.params.email;
      if (req.decoded_email !== email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const applications = await applicationsCollection
        .find({ userEmail: email })
        .toArray();

      const stats = {
        totalApplied: applications.length,
        pending: applications.filter(
          (app) => !app.applicationStatus || app.applicationStatus === "pending"
        ).length,
        processing: applications.filter(
          (app) => app.applicationStatus === "processing"
        ).length,
        completed: applications.filter(
          (app) => app.applicationStatus === "completed"
        ).length,
        rejected: applications.filter(
          (app) => app.applicationStatus === "rejected"
        ).length,
      };
      res.send(stats);
    }
  );

  app.get(
    "/analytics/chart-data",
    verifyFirebaseToken,
    verifyAdmin,
    async (req, res) => {
      const result = await applicationsCollection
        .aggregate([
          {
            $group: {
              _id: "$scholarshipCategory",
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();
      const formatted = result.map(item => ({ name: item._id || 'Unknown', value: item.count }));
      res.send(formatted);
      console.log(result);

    }
  );

  app.get(
    "/analytics/moderator-stats",
    verifyFirebaseToken,
    verifyModerator,
    async (req, res) => {
      const applications = await applicationsCollection.find().toArray();
      const stats = {
        totalApplied: applications.length,
        pending: applications.filter(
          (app) => !app.applicationStatus || app.applicationStatus === "pending"
        ).length,
        processing: applications.filter(
          (app) => app.applicationStatus === "processing"
        ).length,
        completed: applications.filter(
          (app) => app.applicationStatus === "completed"
        ).length,
      };
      res.send(stats);
    }
  );

  // Application Management
  app.delete("/applications/:id", verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await applicationsCollection.deleteOne(query);
    res.send(result);
  });

  app.patch("/applications/:id", verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const data = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: data,
    };
    const result = await applicationsCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  // Reviews
  app.post("/reviews", verifyFirebaseToken, async (req, res) => {
    const review = req.body;
    review.createdAt = new Date();
    const result = await reviewsCollection.insertOne(review);
    res.send(result);
  });

  app.get("/reviews/:email", verifyFirebaseToken, async (req, res) => {
    const email = req.params.email;
    if (req.decoded_email !== email) {
      return res.status(403).send({ message: "forbidden access" });
    }
    const query = { userEmail: email };
    const result = await reviewsCollection.find(query).toArray();
    res.send(result);
  });

  app.get("/reviews/scholarship/:scholarshipId", verifyFirebaseToken, async (req, res) => {
    const scholarshipId = req.params.scholarshipId;
    const query = { scholarshipId: scholarshipId };
    const result = await reviewsCollection.find(query).toArray();
    res.send(result);
  });

  app.get("/all-reviews", verifyFirebaseToken, verifyModerator, async (req, res) => {
    const result = await reviewsCollection.find().toArray();
    res.send(result);
  });

  app.delete("/reviews/:id", verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const query = { _id: new ObjectId(id) };
    const result = await reviewsCollection.deleteOne(query);
    res.send(result);
  });

  app.patch("/reviews/:id", verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const review = req.body;
    const query = { _id: new ObjectId(id) };
    const updateDoc = {
      $set: {
        ratingPoint: review.ratingPoint,
        reviewComment: review.reviewComment,
      },
    };
    const result = await reviewsCollection.updateOne(query, updateDoc);
    res.send(result);
  });

  //   // Send a ping to confirm a successful connection
  //   await client.db("admin").command({ ping: 1 });
  //   console.log("Pinged your deployment. You successfully connected to MongoDB!");
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Scholar Stream Server");
});

app.listen(port, () => {
  console.log("port running on", port);
});
