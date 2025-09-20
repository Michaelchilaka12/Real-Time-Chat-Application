const path = require('path')
const express = require('express');
const cors = require('cors')
// const rateLimit = require('express-rate-limit')
// const helmet = require('helmet');
// const hpp = require('hpp')
const cookieParser = require('cookie-parser');



const userRoute = require('./routes/userRoutes')
const viewRoutes = require("./routes/viewRoutes");
const chatRoutes = require("./routes/chatRoutes");





const app = express();
app.use(cors({
  origin: 'http://localhost:3000',   // your frontend origin
  credentials: true                  // ✅ allow cookies
}));



//using a template view engine
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'))


//how to serve a static file
app.use(express.static(path.join(__dirname, 'public')))

// //body parser, reading data from body into req.body
// app.use(express.json({limit: '10kb'}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cookieParser());



//route mounting
app.use("/", viewRoutes);
app.use("/chat", chatRoutes);
app.use('/api/v1/users', userRoute)




module.exports = app