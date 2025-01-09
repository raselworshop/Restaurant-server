const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5hy3n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const usersCollection = client.db('Bistro_BOSS').collection('users')
    const menuCollection = client.db('Bistro_BOSS').collection('menu')
    const reviewsCollection = client.db('Bistro_BOSS').collection('reviews')
    const cartsCollection = client.db('Bistro_BOSS').collection('carts')
    const paymentsCollection = client.db('Bistro_BOSS').collection('payments')

    // jwt related
    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET_KEY, { expiresIn: "5h" });
      res.send({ token })
    })
    const tokenVerify = (req, res, next) => {
      console.log("inside tokenVerify", req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(403).send({ message: "Access forbidden" })
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decode) => {
        if (err) {
          return res.status(401).send({ message: "Unauthorized access" })
        }
        req.user = decode;
        next();
      })
    }
    // verify admin after tokenVerify
    const verifyAdmin = async (req, res, next) => {
      const email = req.user.email;
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      const isAdmin = user?.role === 'admin'
      if (!isAdmin) {
        return res.status(403).send({ message: "Access forbidden" })
      }
      next()
    }
    // user related 
    app.get('/users', tokenVerify, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result)
    })
    app.get('/users/admin/:email', tokenVerify, async (req, res) => {
      const email = req.params.email;
      if (email !== req.user.email) {
        return res.status(403).send({ message: "Access forbidden!" })
      }
      const query = { email: email }
      const user = await usersCollection.findOne(query)
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })
    app.post('/users', async (req, res) => {
      const user = req.body;
      console.log(user)
      const query = { email: user.email }
      // check if user already exist i db it can be done many ways (1. unique email, 2. upsert, 3. simple checking)
      const isExist = await usersCollection.findOne(query)
      if (isExist) {
        return res.send({ message: "User alredy exist", insertedId: null })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result)
    })
    app.patch('/users/admin/:id', tokenVerify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updateDoc)
      res.send(result)
    })
    app.delete('/users/:id', tokenVerify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await usersCollection.deleteOne(query)
      res.send(result)
    })
    // all items 
    app.get('/menu', async (req, res) => {
      const result = await menuCollection.find().toArray();
      res.send(result)
    })
    // final recheck nedd to perform: done
    app.get('/menu/:id', async (req, res) => {
      const id = req.params.id;
      console.log('Received ID:', id);
      try {
        const filter = { _id: new ObjectId(id) };
        const result = await menuCollection.findOne(filter);
        console.log('Data retrieved from database:', result);
        if (!result) {
          return res.status(404).send({ message: 'Item not found' });
        }
        res.send(result);
      } catch (error) {
        console.error('Error retrieving item:', error);
        res.status(500).send({ message: 'Error retrieving item' });
      }
    });
       
    app.post('/menu', tokenVerify, verifyAdmin, async (req, res) => {
      const item = req.body;
      const result = await menuCollection.insertOne(item)
      res.send(result)
    })
    app.patch('/menu/:id', async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter= {_id: new ObjectId(id)}
      const updateDoc={
        $set:{
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image,
        }
      }
      const result = await menuCollection.updateOne(filter, updateDoc)
      res.send(result)
    })
    app.delete('/menu/:id', tokenVerify, verifyAdmin, async (req, res) => {
      console.log("Token Verified:", req.user);
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      console.log("ID received in backend:", id);
      console.log("Query being used:", query);

      const result = await menuCollection.deleteOne(query);
      res.send(result)
    })

    // reviews related 
    app.get('/reviews', async (req, res) => {
      const result = await reviewsCollection.find().toArray();
      res.send(result)
    })
    // cartsCollection related 
    app.get('/carts', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      const result = await cartsCollection.find(query).toArray();
      res.send(result)
    })
    app.post('/carts', async (req, res) => {
      const cartItem = req.body;
      const result = await cartsCollection.insertOne(cartItem)
      res.send(result)
    })
    app.delete('/carts/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await cartsCollection.deleteOne(query)
      res.send(result)
    })

    // payment intent 
    app.post('/create-checkout-session', async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100)
      console.log("inside intent amount", amount)

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        "payment_method_types":[ "card" ]
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    // save payments data in db 
    app.post('/payments', async (req, res) => {
      const payment = req.body;
      console.log("Saved Payment db: ",payment)
      const paymentResult= await paymentsCollection.insertOne(payment)

      //carefully delete item from the cart in db
      const query = {_id:{
        $in: payment.cartIds.map(id=> new ObjectId(id))
      }}
      const deletResult = await cartsCollection.deleteMany(query)
      res.send({paymentResult, deletResult})
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', async (req, res) => {
  res.send(`Bistro_BOSS server is running on:${port}`)
})

app.listen(port, () => {
  console.log(`Bistro BOSS server running on: ${port} PORT`)
})