const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
require('dotenv').config()

const port = process.env.PORT || 9000
const app = express()

app.use(cors())
app.use(express.json())

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.w0juy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const db = client.db('solo-db');
    const jobCOllection = db.collection('jobs')

    // save job data in db
    app.post('/add-job', async (req, res) => {
      const jobData = req.body;
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
      const query= {'buyer.email': email}
      const result = await jobCOllection.find(query).toArray();
      res.send(result)
    })

    // delete job from db
    app.delete('/job/:id', async (req,res)=>{
      const id=req.params.id
      const query= {_id : new ObjectId(id)}
      const result=await jobCOllection.deleteOne(query)
    })

    // get a single job data from db
    app.get('/job/:id', async (req,res)=>{
      const id = req.params.id
      const query= {_id : new ObjectId(id)}
      const result= await jobCOllection.findOne(query)
      res.send(result)
    })
//update job from db
app.put('/update-job/:id', async (req,res)=>{
const id=req.params.id
const jobData=req.body
const updated={
  $set: jobData
}
const query={_id : new ObjectId(id)}
const options= {upsert : true}
const result=await jobCOllection.updateOne(query,updated,options)
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
