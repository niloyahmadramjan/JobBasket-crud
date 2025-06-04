// Required imports
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware setup
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

// JWT Token API (Issue Token)
app.post("/jwt", async (req, res) => {
  const userData = req.body;
  const token = jwt.sign(userData, process.env.JWT_ACCESS_SECRET, {
    expiresIn: "1h",
  });

  // Set cookie with token
  res.cookie("tokenJobPortal", token, {
    httpOnly: true,
    secure: false, // Should be true in production with HTTPS
  });

  res.send({ success: true });
});



// Token verification middleware
const verifyToken = (req, res, next) => {
  const token = req?.cookies?.tokenJobPortal;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.JWT_ACCESS_SECRET, (error, decoded) => {
    if (error) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

// MongoDB setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eznirgn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const jobsCollection = client.db("jobportal").collection("jobs");
    const applicationsCollection = client.db("jobportal").collection("applicatoins");

    // Get all jobs or jobs by HR email
    app.get("/jobs", async (req, res) => {
      const email = req.query.email;
      const query = email ? { hr_email: email } : {};
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // Get single job by ID
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const result = await jobsCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Get all applications for a job
    app.get("/viewApplications/:id", async (req, res) => {
      const id = req.params.id;
      const query = { jobId: id };
      const result = await applicationsCollection.find(query).toArray();
      res.send(result);
    });

    // Post a new job
    app.post("/jobs", async (req, res) => {
      const newJob = req.body;
      const result = await jobsCollection.insertOne(newJob);
      res.send(result);
    });

    // Update application status by ID
    app.patch("/status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: { status: req.body.status },
      };
      const result = await applicationsCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // Get applications by user (protected route)
    app.get("/applications", verifyToken, async (req, res) => {
      const email = req.query.email;

      if (email !== req.decoded?.email) {
        return res.status(403).send({ message: "Forbidden access" });
      }

      const result = await applicationsCollection.find({ email }).toArray();

      for (const application of result) {
        try {
          const jobId = application.jobId;

          if (!ObjectId.isValid(jobId)) continue;

          const job = await jobsCollection.findOne({ _id: new ObjectId(jobId) });

          if (job) {
            application.company = job.company;
            application.title = job.title;
            application.applicationDeadline = job.applicationDeadline;
            application.location = job.location;
          }
        } catch (err) {
          console.error(`Error: ${err.message}`);
        }
      }

      res.send(result);
    });

    // Submit a new job application
    app.post("/applications", async (req, res) => {
      const application = req.body;
      const result = await applicationsCollection.insertOne(application);
      res.send(result);
    });

    // Delete an application by ID
    app.delete("/applications/:id", async (req, res) => {
      const id = req.params.id;
      const result = await applicationsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Delete a posted job by ID
    app.delete("/postedJobs/:id", async (req, res) => {
      const id = req.params.id;
      const result = await jobsCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Ping MongoDB to confirm connection
    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully.");

  } finally {
    // Do not close client here for server persistence
  }
}
run().catch(console.dir);

// Root route
app.get("/", (req, res) => {
  res.send("Job Portal server is running...");
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
