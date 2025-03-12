const express = require('express')
const cors = require('cors')
require('dotenv').config()

const app = express()
const port = process.env.PORT || 5000

//middleware
app.use(
  cors({
    origin: [
      "https://free-share0.web.app",
      "https://free-share0.firebaseapp.com",
    ],
    credentials: true,
  })
);
app.use(express.json())

app.get('/', (_, res) => {
  res.send('Hello from the other side...')
})

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@clustermuntasir.bwzlexy.mongodb.net/?retryWrites=true&w=majority&appName=clusterMuntasir`

// Create a MongoClient with a MongoClientOptions object
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

const DB = client.db('FREE_SHARE_DB')
const userCollection = DB.collection('user')
const contentCollection = DB.collection('content')
const conversationCollection = DB.collection('conversation')

async function run () {
  try {
    // await client.connect()
    // await client.db('admin').command({ ping: 1 })
    console.log('Pinged your deployment. Successfully connected to MongoDB!')

    // add new user
    app.post('/users', async (req, res) => {
      console.log('post /users api is hit...')
      const { displayName, email, photoURL, password } = req.body
      const newUser = {
        displayName,
        email,
        photoURL,
        password,
        savedContent: [],
        inbox: [],
        outbox: [],
        likedContent: []
      }
      const fetchedInbox = await conversationCollection
        .find({ receiver: email })
        .toArray()

      newUser.inbox = fetchedInbox
      const result = await userCollection.insertOne(newUser)
      res.send(result)
    })

    // get a user
    app.get('/users/:email', async (req, res) => {
      console.log('get /users/:email api is hit...')
      // const email = req.params.userEmail;
      res.send(await userCollection.findOne({ email: req.params.email }))
    })

    //post a new content
    app.post('/contents', async (req, res) => {
      console.log('Post /contents api is hit...')
      console.log(req.body);
      const { title, description, imgURL, uploader, isPublic, isAnonymous } =
        req.body
      const uploadTime = new Date().toISOString()
      const isAdminApproved = false
      const likedCount = 0
      const newContent = {
        title,
        description,
        image: imgURL,
        uploader,
        isPublic,
        isAnonymous,
        uploadTime,
        isAdminApproved,
        likedCount
      }
      const result = await contentCollection.insertOne(newContent)
      res.send(result)
    })

    // get all public contents
    app.get('/contents', async (_, res) => {
      console.log('Get /contents api is hit...')
      res.send(await contentCollection.find({ isPublic: true }).toArray())
    })

    // share content
    app.post('/conversations', async (req, res) => {
      console.log('Post /conversation api is hit...')
      console.log(req.body)
      const { content, sender, receiver, isSenderAnonymous } = req.body
      const sendTime = new Date().toISOString()
      const transferredContent = {
        content,
        sender,
        receiver,
        isAnonymous: isSenderAnonymous,
        sendTime
      }
      const result = await conversationCollection.insertOne(transferredContent)

      // update sender outbox if the it is not anonymous
      if (sender) {
        const senderOutbox = await conversationCollection
          .find({ sender: sender })
          .toArray()
        const updatedOutbox = senderOutbox.map(
          content => new ObjectId(content._id)
        )
        await userCollection.updateOne(
          { email: sender },
          { $set: { outbox: updatedOutbox } }
        )
      }

      // update receiver inbox if the user exists
      const isReceiverExist = await userCollection.findOne({ email: receiver })
      if (isReceiverExist.email) {
        const receiverInbox = await conversationCollection
          .find({ receiver: isReceiverExist.email })
          .toArray()

        const updatedInbox = receiverInbox.map(
          content => new ObjectId(content._id)
        )

        await userCollection.updateOne(
          { email: receiver },
          { $set: { inbox: updatedInbox } }
        )
      }

      res.send(result)
    })

    // get conversations of an user
    app.get('/conversations/:email', async (req, res) => {
      console.log('Get /conversations/:email api is hit...')
      const { email } = req.params
      const userInfo = await userCollection.findOne({ email: email })
      // fetching inbox
      const userInboxIds = userInfo.inbox
      const inbox = await conversationCollection
        .find({ _id: { $in: userInboxIds } })
        .toArray()

      //fetching outbox
      const userOutboxIds = userInfo.outbox
      const outbox = await conversationCollection
        .find({ _id: { $in: userOutboxIds } })
        .toArray()

      res.send({ inbox, outbox })
    })

    // fetch and set inbox and outbox value
    app.patch('/testing', async (req, res) => {
      console.log('patch /testing api is hit...')
      const fetchedInbox = await conversationCollection
        .find({ receiver: 'kazimuntasirrahman@gmail.com' })
        .toArray()

      inbox = fetchedInbox.map(item => new ObjectId(item._id))
      const result = await userCollection.updateOne(
        { email: 'kazimuntasirrahman@gmail.com' },
        { $set: { inbox } }
      )
      res.send(result)
    })

    //add a new field
    app.patch('/contents/add-field/:field_name', async (req, res) => {
      console.log('Patch /contents/add-field/:field_name api is hit...')
      const { field_name } = req.params
      const result = await contentCollection.updateMany(
        {},
        { $set: { [field_name]: [] } }
      )
      res.send(result)
    })

    //remove a field
    app.patch('/contents/remove-field/:field_name', async (req, res) => {
      console.log('Patch contents/remove-field/:field_name api is hit...')
      const { field_name } = req.params
      const result = await contentCollection.updateMany(
        {},
        { $unset: { [field_name]: '' } }
      )
      res.send(result)
    })
  } finally {
    // Uncomment this line if you want to keep the connection open
    // await client.close();
  }
}

run().catch(console.dir)

app.listen(port, () => {
  console.log(`This server is running in the port no: ${port}`)
})
