const express = require("express");
const app = express();

const userRoute = require('./src/routes/userRoutes');
const messageRoute= require('./src/routes/messageRoutes')
app.use("/user", userRoute);
app.use("/message", messageRoute);
module.exports = app;