const mongoose = require('mongoose');
const dotenv = require('dotenv');



dotenv.config({path:'./.env'});
const http = require('http');
const app = require('./app')
const { Server } = require('socket.io');
const socketHandler = require('./socket'); // import socket file

//replacing the password tag with the rigth password in my connection string
const DB = process.env.DATABASE.replace('<db_password>',process.env.DATABASE_PASSWORD);

//online database connect
mongoose.connect(DB, {
    // useNewUrlParser:true,
    // useCreateIndex:true,
    // useFindAndModify: false
}).then(() => console.log('DB connections successful!'))


// Create HTTP server with Express app
const server = http.createServer(app);

// Attach Socket.IO to server
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // frontend origin
    methods: ["GET", "POST"],
    credentials: true
  }
});

// 🔹 Initialize socket.io from external file
socketHandler(io);






const Port = process.env.PORT || 3000;
server.listen(Port, ()=>{
    console.log(`server runing on port ${Port}`);
    
})