const express = require('express')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()
const jwt = require('jsonwebtoken')

const port = process.env.PORT || 9000
const app = express()
const corsOptions = {
  origin: ['http://localhost:5173'],
  credentials: true,
  optionalSuccessStatus: 200,
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w0juy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

// verifyToken
const verifyToken = (req, res, next) => {
  console.log('hello , I am verify token')
  const token = req.cookies?.token
  console.log(token)
  if (!token) return res.status(401).send({ message: 'unauthorized Acces' })
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'unauthorized Acces' })
    }
    req.user = decoded;
    next()
  })


}

async function run() {
  try {
    const db = client.db('solo-db');
    const jobCOllection = db.collection('jobs')
    const bidCollection = db.collection('bids')

    // generate json web token
    app.post('/jwt', async (req, res) => {
      const { email } = req.body   // ✅ email extract

      if (!email) {
        return res.status(400).send({ message: 'Email is required' })
      }

      const token = jwt.sign(
        { email },                 // ✅ payload
        process.env.SECRET_KEY,   // ✅ secret
        { expiresIn: '365d' }
      )

      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
        .send({ success: true })       // ✅ correct response
    })
    // Logout || clear cookie
    app.get('/logoutCookie', async (req, res) => {

      res.clearCookie('token', {
        maxAge: 0,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict'
      })
        .send({ success: true })
    })


    // save job data in db
    app.post('/add-job', async (req, res) => {
      const jobData = req.body;
      if (jobData.deadline) {
        jobData.deadline = new Date(jobData.deadline); // 🔥 MUST
      }
      const result = await jobCOllection.insertOne(jobData)
      res.send(result)
    })

    // get add job data in db

    app.get('/jobs', async (req, res) => {

      const result = await jobCOllection.find().toArray();
      res.send(result)
    })

    // get job by specific user

    app.get('/jobs/:email', async (req, res) => {

      const email = req.params.email
      const query = { 'buyer.email': email }
      const result = await jobCOllection.find(query).toArray();
      res.send(result)
    })

    // delete job from db
    app.delete('/job/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await jobCOllection.deleteOne(query)
    })

    // get a single job data from db
    app.get('/job/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await jobCOllection.findOne(query)

      res.send(result)
    })
    //update job from db
    app.put('/update-job/:id', async (req, res) => {
      const id = req.params.id
      const jobData = req.body
      if (jobData.deadline) {
        jobData.deadline = new Date(jobData.deadline) // 🔥
      }
      const updated = {
        $set: jobData
      }
      const query = { _id: new ObjectId(id) }
      const options = { upsert: true }
      const result = await jobCOllection.updateOne(query, updated, options)
      res.send(result)
    })
    // save bid data in db
    app.post('/add-bid', async (req, res) => {
      const bidData = req.body;
      // if a user already bid in this job
      const query = { email: bidData.email, jobId: bidData.jobId }
      const alreadyExist = await bidCollection.findOne(query)
      console.log(alreadyExist)
      if (alreadyExist) return res
        .status(400)
        .send('You Already bid this job')
      // add-bid

      const result = await bidCollection.insertOne(bidData)

      // here updated bid_count
      const filter = { _id: new ObjectId(bidData.jobId) }
      const updated = {
        $inc: { bid_count: 1 }
      }
      const updateBidCount = await jobCOllection.updateOne(filter, updated)
      res.send(result)

    })
    // display bids data of a specific user

    app.get('/bids/:email', verifyToken, async (req, res) => {
      const decodedEmail = req.user.email;
      const email = req.params.email;

      console.log('Email From token:', decodedEmail);
      console.log('Email from user:', email);

     
      if (decodedEmail !== email) {
        return res.status(403).send({ message: 'Forbidden Access' });
      }

      const query = { email };
      const result = await bidCollection.find(query).toArray();


      res.send(result);
    });

    // get all bid request for a specific user 

    app.get('/bid-request/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      const query = { buyer: email }
      const result = await bidCollection.find(query).toArray()
      res.send(result)
    })

    // here update the ststus
    app.patch('/bid-status-update/:id', async (req, res) => {
      const id = req.params.id
      const { cuStatus } = req.body

      // console.log(cuStatus)
      const filter = { _id: new ObjectId(id) }
      const updated = {
        $set: { status: cuStatus }
      }
      const result = await bidCollection.updateOne(filter, updated)
      res.send(result)
    })

    // here work for search implemetn

    app.get('/all-jobs', async (req, res) => {
      const { filter, search, sort } = req.query

      let query = {}

      if (search) {
        query.title = { $regex: search, $options: 'i' }
      }

      if (filter) {
        query.category = filter
      }

      let options = {}
      if (sort === 'asc') options.sort = { deadline: 1 }
      if (sort === 'desc') options.sort = { deadline: -1 }

      console.log('SORT:', sort, 'OPTIONS:', options)

      const result = await jobCOllection.find(query, options).toArray()
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)
app.get('/', (req, res) => {
  res.send('Hello from SoloSphere Server....')
})

app.listen(port, () => console.log(`Server running on port ${port}`))
