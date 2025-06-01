const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eznirgn.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const jobsCollection = client.db("jobportal").collection("jobs");
    const applicationsCollection = client
      .db("jobportal")
      .collection("applicatoins");

    // all jobs get from db
    app.get("/jobs", async (req, res) => {
      // get data use query parameter
      const email = req.query.email;
      const query = {};
      if (email) {
        query.hr_email = email;
      }
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // get data use id
    app.get("/jobs/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // post new job
    app.post("/jobs", async (req, res) => {
      const newJobs = req.body;
      const result = await jobsCollection.insertOne(newJobs);
      res.send(result);
    });

    // get applications data use query parameter
    app.get("/applications", async (req, res) => {
      const email = req.query.email;
      const query = {
        email: email,
      };
      const result = await applicationsCollection.find(query).toArray();

      // // bad way to get jobs info
      // for(const application of result){
      //   const jobId = application.jobId;
      //   const jobQuery = {_id: new ObjectId(jobId)}
      //   const job = await jobsCollection.findOne(jobQuery);
      //   application.company = job.company
      //   application.title = job.title
      //   application.applicationDeadline = job.applicationDeadline
      //   application.location = job.location

      // }

      // better way to get jobs info
      for (const application of result) {
        try {
          const _jobId = application.jobId;

          // Safely create ObjectId (check if it's valid string ID)
          if (!ObjectId.isValid(_jobId)) {
            console.warn(`Invalid jobId: ${_jobId}`);
            continue;
          }

          const job = await jobsCollection.findOne({
            _id: new ObjectId(_jobId),
          });

          if (job) {
            application.company = job.company;
            application.title = job.title;
            application.applicationDeadline = job.applicationDeadline;
            application.location = job.location;
          } else {
            console.warn(`Job not found for jobId: ${_jobId}`);
          }
        } catch (err) {
          console.error(`Error processing application: ${err.message}`);
        }
      }

      res.send(result);
    });

    // applications store db
    app.post("/applications", async (req, res) => {
      const applicationsData = req.body;
      const result = await applicationsCollection.insertOne(applicationsData);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("job portal server is running.....");
});

app.listen(port, () => {
  console.log(`server is running on ${port}`);
});
