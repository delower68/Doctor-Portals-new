const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require('jsonwebtoken');

const port = process.env.PORT || 5000;

const app = express();

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tkreg8z.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});




function verifyJWT(req, res, next){
  const authHeader = req.headers.authorization ;
  // console.log(authHeader);
  if(!authHeader){
    return res.status(401).send('unauthorized access')
  }
  const token = authHeader.split(' ')[1];
  // console.log(token);
  jwt.verify(token, process.env.ACCESS_TOKEN, function(err, decoded){
    if(err){
      return res.status(403).send('Forbidden access')
    }
    req.decoded = decoded ;
    next();
  })
}



async function run() {
  try {


    const appointmentOptionCollection = client
      .db("Doctors-Portal")
      .collection("appointmentOptions");

    const bookingsCollection = client.db("Doctors-Portal")
      .collection("bookings");


    const usersCollection = client.db("Doctors-Portal")
      .collection("users");


    const doctorsCollection = client.db("Doctors-Portal")
      .collection("doctors");

    // all appointment data get from mongodb
    // Use Aggregate to query multiple collection and then merge date 
    app.get("/appointmentOptions", async (req, res) => {
      const date = req.query.date ;
      // console.log(date);
      const query = {};
      const options = await appointmentOptionCollection.find(query).toArray();


      const bookingQuery = {appointmentDate: date}
      const alreadyBooked = await bookingsCollection.find(bookingQuery).toArray();


      // code carefully 
      options.forEach(option => {
        const optionBooked = alreadyBooked.filter(book => book.treatment === option.name);
        const bookedSlots = optionBooked.map(book => book.slot);
        const remainingSlots =option.slots.filter(slot => !bookedSlots.includes(slot));
        option.slots = remainingSlots;
        // console.log(date, option.name , remainingSlots.length);
      })

      res.send(options);
    });



    // appointmentSpecialty option gula get kora 
    app.get('/appointmentSpecialty', async(req , res)=>{
      const query ={};
      const result = await appointmentOptionCollection.find(query).project({name: 1}).toArray()
      res.send(result);
    })

    /***
     * Api Naming convention 
     * app.get('bookings)- all bookings data paite cai 
     * app.get('bookings/:id')-bookings theke akta id k load korte cai  
     * app.post ('bookings')-bookings ar moddhe new akta object ba document add korte cai  mongosb te
     * app.patch('bookings')- bookings ar kono data update korte cai 
     * app.delete ('bookings/:id ')- bookings ar moddhe akta booking a=k delete korte cai 
     */

    // ui te appointment gula show korano 
    // local 5000 a link banano bookings gula show koranor jonno 
    app.get('/bookings',verifyJWT,  async(req, res)=>{
      const email = req.query.email ;
      const decodedEmail  = req.decoded.email;

      if(email !== decodedEmail){
        return res.status(403).send({message: 'forbidden access'})
      }


      const query = {email: email};
      const bookings = await bookingsCollection.find(query).toArray();
      res.send(bookings);
    })







    // all bookings data post  on mongodb from  booking form 
    app.post('/bookings', async (req, res)=>{
      const booking = req.body;

      // one user only one appointment in a day 
      const query = {
        appointmentDate: booking.appointmentDate,
        email: booking.email,
        treatment: booking.treatment
      }
      const alreadyBooked = await bookingsCollection.find(query).toArray();
      if(alreadyBooked.length){
        const message = `You already have a booking on ${booking.appointmentDate}`
        return res.send({acknowledged: false, message})
      }

      const result = await bookingsCollection.insertOne(booking);
      res.send(result)
    } )


    // userinfo save mongodb as a object 
    app.post('/users', async(req, res)=>{
      const user = req.body ;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });



    // get all users from mongodb 
    app.get('/users', async(req, res)=>{
      const query = {};
      const users = await usersCollection.find(query).toArray();
      res.send(users)
    })


    // user admin ki na ata check 
    app.get('/users/admin/:email', async(req, res)=>{
      const email = req.params.email ;
      const query = {email};
      const user = await usersCollection.findOne(query);
      res.send({isAdmin: user?.role === 'admin'});
    } )

    // user k update korar jonno 
    app.put('/users/admin/:id', verifyJWT, async(req, res)=>{

      // user jdi admin na hoi tahole onno kaw k admin banate parbe na 
      const decodedEmail = req.decoded.email ;
      const query = {email: decodedEmail};
      const user = await usersCollection.findOne(query);

      if(user?.role !== "admin"){
        return res.status(403).send({message: 'forbidden access'})
      }
      // process end here 

      const id = req.params.id ;
      const filter = {_id: ObjectId(id)}
      const options = {upsert: true};

      const updatedDoc = {
        $set:{
          role: 'admin'
        }
      }
      const result = await usersCollection.updateOne(filter, updatedDoc, options);
      res.send(result);
    })


    // doctors post on the mongodb 
    app.post('/doctors',verifyJWT, async(req, res)=>{
      const doctor = req.body ;
      const result = await doctorsCollection.insertOne(doctor);
      res.send(result);
    })

    // all doctors show on the UI 
    app.get('/doctors',verifyJWT, async(req, res )=>{
      const query = {}
      const doctors = await doctorsCollection.find(query).toArray();
      res.send(doctors)
    })

    app.delete('/doctors/:id',verifyJWT, async(req, res)=>{
      const id = req.params.id ;
      const filter = {_id: ObjectId(id)}
      const result = await doctorsCollection.deleteOne(filter);
      res.send(result);
    })




    // jwt token create 
    app.get('/jwt', async(req, res)=>{
      const email = req.query.email ;
      const query = {email: email }
      const user = await usersCollection.findOne(query);
      if(user){
        const token = jwt.sign({email}, process.env.ACCESS_TOKEN, {expiresIn: '5h'});

        return res.send({accessToken: token})

      }
      res.status(403).send({accessToken: ''})
    })

  } finally {
  }
}
run().catch((err) => console.log(err));

app.get("/", async (req, res) => {
  res.send("doctors portal server is running");
});

app.listen(port, () => console.log(`Doctors portal running on ${port}`));
